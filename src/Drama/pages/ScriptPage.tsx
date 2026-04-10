import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { t } from '../i18n';
import type { Character, Shot } from '../types';
import type { AigramState } from '../hooks/useAigram';
import { SHOT_PRESETS } from '../utils/presets';
import { generateSceneImage, subscribeCooldown, uploadImage, suggestNextShot, generateEndFramePrompt } from '../utils/imageApi';
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
  if (f.phase === 'waiting')     return f.wait > 0 ? `${f.wait}s` : t('script.aboutToGen');
  if (f.phase === 'generating')  return t('script.generating');
  if (f.phase === 'downloading') return t('script.downloading');

  const action = f.phase === 'error'
    ? t('script.genFailed')
    : (f.url ? t('script.regen') : (isStart ? t('script.genStart') : t('script.genEnd')));

  if (cooldown > 0) {
    return <>{action} <span className="ad-shot__frame-btn-cd">{cooldown}s {t('script.cooldown')}</span></>;
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

  const generateFrame = useCallback(async (
    shotId: string,
    prompt: string,
    type: 'start' | 'end',
    character: Character | null,
    signal: { cancelled: boolean },
  ) => {
    if (!prompt.trim() || signal.cancelled) return;

    let apiPrompt: string;
    let refUrl: string;

    if (type === 'end') {
      // Use AI to generate a differentiated end-frame prompt (camera/action change, same style)
      patchFrame(shotId, type, { phase: 'generating', wait: 0 });
      const aiPrompt = await generateEndFramePrompt(prompt, character?.avatar_describe);
      if (signal.cancelled) return;
      apiPrompt = aiPrompt || buildEndPrompt(prompt, character);
      // Keep character ref image to maintain consistent art style
      refUrl = character?.head_url || '';
    } else {
      apiPrompt = buildPrompt(prompt, character);
      refUrl = character?.head_url || '';
    }

    generateSceneImage(
      apiPrompt,
      refUrl,
      (wait) => { if (!signal.cancelled) patchFrame(shotId, type, { phase: 'waiting', wait }); },
      ()     => { if (!signal.cancelled) patchFrame(shotId, type, { phase: 'generating', wait: 0 }); },
      ()     => signal.cancelled,
      true, // skip rehost for preview — only needed at video submission time
    ).then(url => {
      if (signal.cancelled) return;
      patchFrame(shotId, type, { phase: 'downloading', wait: 0, url });
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
        <span className="ad-script__title">{t('script.title')}</span>
      </div>

      {/* Shot nav */}
      <div className="ad-script__nav">
        {shots.map((shot, i) => {
          const hasFill = shot.prompt.trim().length > 0;
          return (
            <button
              key={shot.id}
              className={`ad-script__nav-item${i === 0 ? ' ad-script__nav-item--active' : ''}${hasFill && i > 0 ? ' ad-script__nav-item--filled' : ''}`}
              onPointerDown={() => {
                const el = document.getElementById(`shot-${shot.id}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <span className="ad-script__nav-num">{i + 1}</span>
              <span className="ad-script__nav-label">Scene</span>
            </button>
          );
        })}
        {shots.length < 8 && (
          <button className="ad-script__nav-item ad-script__nav-item--add" onPointerDown={addShot}>+</button>
        )}
      </div>

      <div className="ad-shots">
        {shots.map((shot, i) => {
          const f = sf(shot.id);
          const hasPrompt = shot.prompt.trim().length > 0;
          const char = resolveShotChar(shot, shots, defaultCharacter);
          const isInherited = !shot.character;
          const charInitials = char?.name.slice(0, 2).toUpperCase() || '?';
          // Check if previous shot has an end frame (for "use prev end frame" button)
          const prevEndUrl = i > 0 ? sf(shots[i - 1].id).end.url : undefined;
          const startFrame = f.start;
          const showUsePrev = prevEndUrl && !startFrame.url && !isBusy(startFrame);

          return (
            <div key={shot.id} id={`shot-${shot.id}`} className="ad-shot">
              <div className="ad-shot__header-row">
                <span className="ad-shot__num">SCENE {i + 1}</span>
                {shots.length > 1 && (
                  <button className="ad-shot__remove" onClick={() => removeShot(shot.id)}>✕</button>
                )}
              </div>
              <div
                className={`ad-shot__char-badge${isInherited ? ' ad-shot__char-badge--inherited' : ''}`}
                onClick={() => setCharSelectFor(shot.id)}
              >
                <div className="ad-shot__char-badge-avatar">
                  {char?.head_url
                    ? <img src={char.head_url} alt={char.name} draggable={false} />
                    : <span>{charInitials}</span>}
                </div>
                <span className="ad-shot__char-badge-name">
                  {char?.name || t('script.selectChar')}
                </span>
                {i === 0 && isInherited && <span className="ad-shot__char-badge-tag">{t('script.default')}</span>}
                <span className="ad-shot__char-badge-arrow">▾</span>
              </div>

              {/* Frames row */}
              <div className="ad-shot__frames">
                {(['start', 'end'] as const).map((type, fi) => {
                  const frame = f[type];
                  const busy = isBusy(frame);
                  const isStart = type === 'start';
                  const inputId = `upload-${shot.id}-${type}`;
                  return (
                    <React.Fragment key={type}>
                      {fi > 0 && <span className="ad-shot__frame-arrow">&rarr;</span>}
                      <div className="ad-shot__frame-col">
                        <div className="ad-shot__frame">
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
                                    alt={isStart ? t('script.startFrame') : t('script.endFrame')}
                                    draggable={false}
                                    onLoad={() => patchFrame(shot.id, type, { phase: 'idle' })}
                                    onError={() => patchFrame(shot.id, type, ERROR)}
                                  />
                                  <span className="ad-shot__frame-replace">{t('script.replace')}</span>
                                </>
                              : <div className={`ad-shot__frame-empty ${!isStart ? 'ad-shot__frame-empty--dim' : ''} ${busy ? 'ad-shot__frame-empty--loading' : ''}`}>
                                  {busy
                                    ? <span className="ad-shot__frame-spinner" />
                                    : <><span className="ad-shot__frame-upload-icon">+</span><span className="ad-shot__frame-upload-hint">{isStart ? t('script.startFrame') : t('script.endFrame')}</span></>
                                  }
                                </div>
                            }
                          </label>
                        </div>
                        <button
                          className={`ad-shot__frame-btn ${!isStart ? 'ad-shot__frame-btn--dim' : ''} ${frame.phase === 'waiting' || ((frame.phase === 'idle' || frame.phase === 'error') && cooldown > 0) ? 'ad-shot__frame-btn--queued' : ''}`}
                          onClick={() => {
                            if (!busy) {
                              const shotChar = resolveShotChar(shot, shots, defaultCharacter);
                              generateFrame(shot.id, shot.prompt, type, shotChar, { cancelled: false });
                            }
                          }}
                          disabled={!hasPrompt || busy}
                        >
                          {btnContent(frame, isStart, cooldown)}
                        </button>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Use prev end — full-width below frames */}
              {showUsePrev && (
                <button
                  className="ad-shot__use-prev"
                  onClick={() => patchFrame(shot.id, 'start', { phase: 'idle', wait: 0, url: prevEndUrl })}
                >
                  &larr; {t('script.usePrevEnd')}
                </button>
              )}

              {/* Divider */}
              <div className="ad-shot__divider" />

              <textarea
                className="ad-shot__input"
                value={shot.prompt}
                onChange={e => {
                  updatePrompt(shot.id, e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                ref={el => { if (el && shot.prompt) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                placeholder={suggestingId === shot.id ? t('script.aiSuggesting') : t('script.placeholder')}
              />
              <div className="ad-shot__hints">
                {SHOT_PRESETS.slice(i * 2, i * 2 + 2).map(p => (
                  <span key={p} className="ad-shot__hint" onClick={() => updatePrompt(shot.id, p)}>
                    {p}
                  </span>
                ))}
              </div>

            </div>
          );
        })}

        {shots.length < 8 && (
          <button className="ad-add-shot" onClick={addShot}>
            {t('script.addShot')}({shots.length}/8)
          </button>
        )}
      </div>

      <div className="ad-script__footer">
        <button
          className="ad-generate-btn"
          onPointerDown={handleGenerate}
          disabled={!canGenerate}
        >
          {t('script.go')} {activeCount} {t('script.shots')}
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
