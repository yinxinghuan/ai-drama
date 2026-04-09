import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import type { Character, Shot } from '../types';
import type { AigramState } from '../hooks/useAigram';
import { SHOT_PRESETS } from '../utils/presets';
import { generateSceneImage, subscribeCooldown, uploadImage, suggestNextShot } from '../utils/imageApi';
import CharacterSelect from '../components/CharacterSelect';
import './ScriptPage.less';

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  aigram: AigramState;
  defaultCharacter: Character | null;
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

function buildPrompt(userPrompt: string, character: Character | null): string {
  const parts: string[] = [];
  if (character?.avatar_describe) parts.push(character.avatar_describe);
  if (character?.style) parts.push(`${character.style} style`);
  parts.push('cinematic film');
  parts.push(userPrompt);
  return parts.join(', ');
}

function buildEndPrompt(userPrompt: string, character: Character | null): string {
  const parts = userPrompt.split('，');
  const endPrompt = parts.length > 2
    ? [parts[0], ...parts.slice(-2)].join('，')
    : userPrompt;
  return buildPrompt(endPrompt, character) + ', final moment';
}

// ── Resolve per-shot character ───────────────────────────────────────────────

function resolveShotChar(shot: Shot, shots: Shot[], defaultChar: Character | null): Character | null {
  return shot.character ?? shots[0]?.character ?? defaultChar;
}

// ── Frame state ───────────────────────────────────────────────────────────────

type FramePhase = 'idle' | 'waiting' | 'generating' | 'downloading' | 'error';

interface FrameData {
  phase: FramePhase;
  wait: number;
  url?: string;
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

export default function ScriptPage({ aigram, defaultCharacter, shots, onShotsChange, onGenerate, onBack }: Props) {
  const [frames, setFrames] = useState<Record<string, ShotFrames>>({});
  const [cooldown, setCooldown] = useState(0);
  const [charSelectFor, setCharSelectFor] = useState<string | null>(null);

  useEffect(() => subscribeCooldown(setCooldown), []);

  // Build character list for selection modal
  const { me, contacts } = aigram;
  const allChars: Character[] = [];
  if (me) allChars.push(me);
  contacts.forEach(c => { if (c.telegram_id !== me?.telegram_id) allChars.push(c); });

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
    character: Character | null,
    signal: { cancelled: boolean },
  ) => {
    if (!prompt.trim() || signal.cancelled) return;

    const apiPrompt = type === 'end'
      ? buildEndPrompt(prompt, character)
      : buildPrompt(prompt, character);

    generateSceneImage(
      apiPrompt,
      character?.head_url || '',
      (wait) => { if (!signal.cancelled) patchFrame(shotId, type, { phase: 'waiting', wait }); },
      ()     => { if (!signal.cancelled) patchFrame(shotId, type, { phase: 'generating', wait: 0 }); },
      ()     => signal.cancelled,
      true, // skip rehost for preview — only needed at video submission time
    ).then(url => {
      if (signal.cancelled) return;
      patchFrame(shotId, type, { phase: 'idle', wait: 0, url });
    }).catch(err => {
      if (!signal.cancelled) {
        console.error('生图失败', err);
        patchFrame(shotId, type, ERROR);
      }
    });
  }, [patchFrame]);

  // No auto-generation — user must manually click "生成首帧" per shot

  // ── Shot mutations ─────────────────────────────────────────────────────────

  const updatePrompt = (id: string, prompt: string) => {
    onShotsChange(prev => prev.map(s => s.id === id ? { ...s, prompt } : s));
  };

  const [suggestingId, setSuggestingId] = useState<string | null>(null);

  const addShot = () => {
    if (shots.length >= 8) return;
    const newShot = makeShot();
    onShotsChange(prev => [...prev, newShot]);

    // AI suggest based on previous shots that have content
    const existing = shots.map(s => s.prompt).filter(p => p.trim());
    if (existing.length > 0) {
      setSuggestingId(newShot.id);
      suggestNextShot(existing).then(suggestion => {
        if (suggestion) {
          onShotsChange(prev => prev.map(s => s.id === newShot.id && !s.prompt.trim() ? { ...s, prompt: suggestion } : s));
        }
        setSuggestingId(null);
      });
    }
  };

  const removeShot = (id: string) => {
    onShotsChange(prev => prev.length <= 1 ? prev : prev.filter(s => s.id !== id));
    setFrames(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleCharPicked = (char: Character) => {
    if (!charSelectFor) return;
    onShotsChange(prev => prev.map(s => s.id === charSelectFor ? { ...s, character: char } : s));
    setCharSelectFor(null);
  };

  // ── Upload ─────────────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, shotId: string, type: 'start' | 'end') => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    patchFrame(shotId, type, { phase: 'downloading', wait: 0 });
    try {
      const url = await uploadImage(file);
      patchFrame(shotId, type, { phase: 'idle', url });
    } catch (err) {
      console.error('上传失败', err);
      patchFrame(shotId, type, ERROR);
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

  return (
    <div className="ad-script">
      <div className="ad-script__header">
        <button className="ad-script__back" onPointerDown={onBack}>←</button>
        <span className="ad-script__title">剧本编辑</span>
      </div>

      <div className="ad-shots">
        {shots.map((shot, i) => {
          const f = sf(shot.id);
          const hasPrompt = shot.prompt.trim().length > 0;
          const char = resolveShotChar(shot, shots, defaultCharacter);
          const isInherited = !shot.character;
          const charInitials = char?.name.slice(0, 2).toUpperCase() || '?';

          return (
            <div key={shot.id} className="ad-shot">
              <div className="ad-shot__header-row">
                <span className="ad-shot__num">镜头 {i + 1}</span>
                <div
                  className={`ad-shot__char-badge${isInherited ? ' ad-shot__char-badge--inherited' : ''}`}
                  onPointerDown={() => setCharSelectFor(shot.id)}
                >
                  <div className="ad-shot__char-badge-avatar">
                    {char?.head_url
                      ? <img src={char.head_url} alt={char.name} draggable={false} />
                      : <span>{charInitials}</span>}
                  </div>
                  <span className="ad-shot__char-badge-name">
                    {char?.name || '选角色'}
                  </span>
                  {i === 0 && isInherited && <span className="ad-shot__char-badge-tag">默认</span>}
                </div>
                {shots.length > 1 && (
                  <button className="ad-shot__remove" onPointerDown={() => removeShot(shot.id)}>✕</button>
                )}
              </div>

              <textarea
                className="ad-shot__input"
                value={shot.prompt}
                onChange={e => updatePrompt(shot.id, e.target.value)}
                placeholder={suggestingId === shot.id ? 'AI 正在续写…' : '描述这个镜头的场景…'}
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
                  const inputId = `upload-${shot.id}-${type}`;
                  // Check if previous shot has an end frame (for "use prev end frame" button)
                  const prevEndUrl = isStart && i > 0 ? sf(shots[i - 1].id).end.url : undefined;
                  return (
                    <div key={type} className="ad-shot__frame">
                      <input
                        id={inputId}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => handleFileChange(e, shot.id, type)}
                        disabled={busy}
                      />
                      <label htmlFor={inputId} className={`ad-shot__frame-area ${busy ? 'ad-shot__frame-area--busy' : ''}`}>
                        {frame.url
                          ? <>
                              <img
                                key={frame.url}
                                className="ad-shot__frame-img"
                                src={frame.url}
                                alt={isStart ? '首帧' : '尾帧'}
                                draggable={false}
                                onLoad={() => patchFrame(shot.id, type, { phase: 'idle' })}
                                onError={() => patchFrame(shot.id, type, ERROR)}
                              />
                              <span className="ad-shot__frame-replace">换图</span>
                            </>
                          : <div className={`ad-shot__frame-empty ${!isStart ? 'ad-shot__frame-empty--dim' : ''} ${busy ? 'ad-shot__frame-empty--loading' : ''}`}>
                              {busy
                                ? <span className="ad-shot__frame-spinner" />
                                : <><span className="ad-shot__frame-upload-icon">＋</span><span>{isStart ? '首帧' : '尾帧'}</span><span className="ad-shot__frame-upload-hint">点击上传</span></>
                              }
                            </div>
                        }
                      </label>
                      <button
                        className={`ad-shot__frame-btn ${!isStart ? 'ad-shot__frame-btn--dim' : ''} ${frame.phase === 'waiting' || ((frame.phase === 'idle' || frame.phase === 'error') && cooldown > 0) ? 'ad-shot__frame-btn--queued' : ''}`}
                        onPointerDown={() => {
                          if (!busy && cooldown === 0) {
                            const shotChar = resolveShotChar(shot, shots, defaultCharacter);
                            generateFrame(shot.id, shot.prompt, type, shotChar, { cancelled: false });
                          }
                        }}
                        disabled={!hasPrompt || busy || cooldown > 0}
                      >
                        {btnContent(frame, isStart, cooldown)}
                      </button>
                      {prevEndUrl && !frame.url && !busy && (
                        <button
                          className="ad-shot__frame-btn ad-shot__frame-btn--use-prev"
                          onPointerDown={() => patchFrame(shot.id, 'start', { phase: 'idle', wait: 0, url: prevEndUrl })}
                        >
                          ← 用上镜尾帧
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}

        {shots.length < 8 && (
          <button className="ad-add-shot" onPointerDown={addShot}>
            + 添加镜头（{shots.length}/8）
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

      {charSelectFor && allChars.length > 0 && (
        <CharacterSelect
          characters={allChars}
          current={resolveShotChar(
            shots.find(s => s.id === charSelectFor) ?? shots[0],
            shots,
            defaultCharacter,
          )}
          onPick={handleCharPicked}
          onClose={() => setCharSelectFor(null)}
        />
      )}
    </div>
  );
}
