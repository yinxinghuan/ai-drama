import { useState, useEffect, useCallback, useRef } from 'react';
import React from 'react';
import type { Character, Shot } from '../types';
import { SHOT_PRESETS, DRAMA_TEMPLATES } from '../utils/presets';
import { generateSceneImage, subscribeCooldown, uploadImage } from '../utils/imageApi';
import './ScriptPage.less';

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  character: Character;
  shots: Shot[];
  onShotsChange: (updater: (prev: Shot[]) => Shot[]) => void;
  onGenerate: (enrichedShots: Shot[]) => void;
  onBack: () => void;
}

// ── Shot factory ─────────────────────────────────────────────────────────────

function makeShot(prompt = ''): Shot {
  return { id: crypto.randomUUID(), prompt, status: 'idle' };
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildPrompt(userPrompt: string, character: Character): string {
  const parts: string[] = [];
  if (character.avatar_describe) parts.push(character.avatar_describe);
  if (character.style) parts.push(`${character.style} style`);
  parts.push('cinematic film');
  parts.push(userPrompt);
  return parts.join(', ');
}

function buildEndPrompt(userPrompt: string, character: Character): string {
  // Take first clause (scene) + last two action clauses → end state differs from start
  const parts = userPrompt.split('，');
  const endPrompt = parts.length > 2
    ? [parts[0], ...parts.slice(-2)].join('，')
    : userPrompt;
  return buildPrompt(endPrompt, character) + ', final moment';
}

// ── Frame state ───────────────────────────────────────────────────────────────
// Single source of truth: phase + url live together.
// Drama.tsx sees frame URLs only when "开拍" is pressed.

type FramePhase = 'idle' | 'waiting' | 'generating' | 'downloading' | 'error';

interface FrameData {
  phase: FramePhase;
  wait: number;   // countdown seconds, relevant during 'waiting'
  url?: string;   // set when API responds, cleared when prompt changes
}

interface ShotFrames { start: FrameData; end: FrameData; }

const IDLE: FrameData  = { phase: 'idle',  wait: 0 };
const ERROR: FrameData = { phase: 'error', wait: 0 };

function isBusy(f: FrameData): boolean {
  return f.phase === 'waiting' || f.phase === 'generating' || f.phase === 'downloading';
}

function btnContent(f: FrameData, isStart: boolean, cooldown: number): React.ReactNode {
  if (f.phase === 'waiting')     return f.wait > 0 ? `${f.wait}s` : '即将生成…';
  if (f.phase === 'generating')  return '生成中…';
  if (f.phase === 'downloading') return '下载中…';

  const action = f.phase === 'error'
    ? '生成失败，重试'
    : (f.url ? '重新生成' : (isStart ? '生成首帧' : '+ 尾帧'));

  if (cooldown > 0) {
    return <>{action} <span className="ad-shot__frame-btn-cd">{cooldown}s 冷却中</span></>;
  }
  return action;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScriptPage({ character, shots, onShotsChange, onGenerate, onBack }: Props) {
  const [showPresets, setShowPresets] = useState(false);
  const [frames, setFrames] = useState<Record<string, ShotFrames>>({});
  const [cooldown, setCooldown] = useState(0);
  const uploadTargetRef = useRef<{ shotId: string; type: 'start' | 'end' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeCooldown(setCooldown), []);

  // ── Frame state helpers ────────────────────────────────────────────────────

  const sf = (id: string): ShotFrames =>
    frames[id] ?? { start: IDLE, end: IDLE };

  const patchFrame = useCallback((id: string, type: 'start' | 'end', patch: Partial<FrameData>) => {
    setFrames(prev => {
      const cur = prev[id] ?? { start: IDLE, end: IDLE };
      return { ...prev, [id]: { ...cur, [type]: { ...cur[type], ...patch } } };
    });
  }, []);

  // ── Generation ─────────────────────────────────────────────────────────────

  const generateFrame = useCallback((
    shotId: string,
    prompt: string,
    type: 'start' | 'end',
    signal: { cancelled: boolean },
  ) => {
    if (!prompt.trim() || signal.cancelled) return;

    const apiPrompt = type === 'end'
      ? buildEndPrompt(prompt, character)
      : buildPrompt(prompt, character);

    generateSceneImage(
      apiPrompt,
      character.head_url,
      (wait) => { if (!signal.cancelled) patchFrame(shotId, type, { phase: 'waiting', wait }); },
      ()     => { if (!signal.cancelled) patchFrame(shotId, type, { phase: 'generating', wait: 0 }); },
      ()     => signal.cancelled,
    ).then(url => {
      if (signal.cancelled) return;
      patchFrame(shotId, type, { phase: 'downloading', wait: 0, url });
    }).catch(err => {
      if (!signal.cancelled) {
        console.error('生图失败', err);
        patchFrame(shotId, type, ERROR);
      }
    });
  }, [character, patchFrame]);

  // Auto-generate start frames on mount and when template applied (IDs change)
  useEffect(() => {
    const signals = new Map<string, { cancelled: boolean }>();
    shots
      .filter(s => s.prompt.trim() && !frames[s.id]?.start.url)
      .forEach(s => {
        const sig = { cancelled: false };
        signals.set(s.id, sig);
        generateFrame(s.id, s.prompt, 'start', sig);
      });
    return () => { signals.forEach(sig => { sig.cancelled = true; }); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots.map(s => s.id).join(',')]);

  // ── Shot mutations ─────────────────────────────────────────────────────────

  const updatePrompt = (id: string, prompt: string) => {
    onShotsChange(prev => prev.map(s => s.id === id ? { ...s, prompt } : s));
    // Keep existing frames; stale images remain visible until user re-generates
  };

  const addShot = () => {
    onShotsChange(prev => prev.length >= 5 ? prev : [...prev, makeShot()]);
  };

  const removeShot = (id: string) => {
    onShotsChange(prev => prev.length <= 1 ? prev : prev.filter(s => s.id !== id));
    setFrames(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const applyTemplate = (prompts: string[]) => {
    onShotsChange(() => prompts.map(p => makeShot(p)));
    setFrames({});
    setShowPresets(false);
  };

  // ── Upload ─────────────────────────────────────────────────────────────────

  const triggerUpload = (shotId: string, type: 'start' | 'end') => {
    uploadTargetRef.current = { shotId, type };
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = uploadTargetRef.current;
    if (!file || !target) return;
    e.target.value = '';
    patchFrame(target.shotId, target.type, { phase: 'downloading', wait: 0 });
    try {
      const url = await uploadImage(file);
      patchFrame(target.shotId, target.type, { phase: 'idle', url });
    } catch (err) {
      console.error('上传失败', err);
      patchFrame(target.shotId, target.type, ERROR);
    }
  };

  // Enrich shots with generated URLs before handing off to Drama.tsx
  const handleGenerate = () => {
    const enriched = shots.map(s => ({
      ...s,
      startImageUrl: frames[s.id]?.start.url,
      endImageUrl: frames[s.id]?.end.url,
    }));
    onGenerate(enriched);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const canGenerate = shots.some(s => s.prompt.trim());
  const activeCount = shots.filter(s => s.prompt.trim()).length;
  const initials = character.name.slice(0, 2).toUpperCase();

  return (
    <div className="ad-script">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <div className="ad-script__header">
        <button className="ad-script__back" onPointerDown={onBack}>←</button>
        <div className="ad-script__char">
          <div className="ad-script__avatar">
            {character.head_url
              ? <img src={character.head_url} alt={character.name} draggable={false} />
              : <span>{initials}</span>}
          </div>
          <span className="ad-script__char-name">{character.name}</span>
        </div>
        <button className="ad-script__preset-btn" onPointerDown={() => setShowPresets(v => !v)}>
          模板
        </button>
      </div>

      {showPresets && (
        <div className="ad-templates">
          {DRAMA_TEMPLATES.map(t => (
            <div key={t.label} className="ad-template-card" onPointerDown={() => applyTemplate(t.shots)}>
              <span className="ad-template-card__label">{t.label}</span>
              <span className="ad-template-card__preview">{t.shots.join(' → ')}</span>
            </div>
          ))}
        </div>
      )}

      <div className="ad-shots">
        {shots.map((shot, i) => {
          const f = sf(shot.id);
          const hasPrompt = shot.prompt.trim().length > 0;
          return (
            <div key={shot.id} className="ad-shot">
              <div className="ad-shot__num">镜头 {i + 1}</div>
              <textarea
                className="ad-shot__input"
                value={shot.prompt}
                onChange={e => updatePrompt(shot.id, e.target.value)}
                placeholder="描述这个镜头的场景…"
                rows={2}
              />
              <div className="ad-shot__hints">
                {SHOT_PRESETS.slice(i * 2, i * 2 + 2).map(p => (
                  <span key={p} className="ad-shot__hint" onPointerDown={() => updatePrompt(shot.id, p)}>
                    {p}
                  </span>
                ))}
              </div>

              <div className="ad-shot__frames">
                {(['start', 'end'] as const).map(type => {
                  const frame = f[type];
                  const busy = isBusy(frame);
                  const isStart = type === 'start';
                  const label = isStart ? '首帧' : '尾帧（可选）';
                  return (
                    <div key={type} className="ad-shot__frame">
                      {frame.url
                        ? <img
                            key={frame.url}
                            className="ad-shot__frame-img"
                            src={frame.url}
                            alt={label}
                            draggable={false}
                            onLoad={() => patchFrame(shot.id, type, { phase: 'idle' })}
                            onError={() => patchFrame(shot.id, type, ERROR)}
                          />
                        : <div className={`ad-shot__frame-empty ${!isStart ? 'ad-shot__frame-empty--dim' : ''} ${busy ? 'ad-shot__frame-empty--loading' : ''}`}>
                            {busy ? <span className="ad-shot__frame-spinner" /> : label}
                          </div>
                      }
                      <button
                        className={`ad-shot__frame-btn ${!isStart ? 'ad-shot__frame-btn--dim' : ''} ${frame.phase === 'waiting' || ((frame.phase === 'idle' || frame.phase === 'error') && cooldown > 0) ? 'ad-shot__frame-btn--queued' : ''}`}
                        onPointerDown={() => { if (!busy && cooldown === 0) generateFrame(shot.id, shot.prompt, type, { cancelled: false }); }}
                        disabled={!hasPrompt || busy || cooldown > 0}
                      >
                        {btnContent(frame, isStart, cooldown)}
                      </button>
                      <button
                        className={`ad-shot__upload-btn ${!isStart ? 'ad-shot__frame-btn--dim' : ''}`}
                        onPointerDown={() => { if (!busy) triggerUpload(shot.id, type); }}
                        disabled={busy}
                      >
                        {frame.url ? '换图' : '上传图片'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {shots.length > 1 && (
                <button className="ad-shot__remove" onPointerDown={() => removeShot(shot.id)}>✕</button>
              )}
            </div>
          );
        })}

        {shots.length < 5 && (
          <button className="ad-add-shot" onPointerDown={addShot}>
            + 添加镜头（{shots.length}/5）
          </button>
        )}
      </div>

      <div className="ad-script__footer">
        <button
          className="ad-generate-btn"
          onPointerDown={handleGenerate}
          disabled={!canGenerate}
        >
          开拍！生成 {activeCount} 个镜头
        </button>
      </div>
    </div>
  );
}
