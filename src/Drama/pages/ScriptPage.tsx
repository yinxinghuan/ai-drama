import { useState, useEffect } from 'react';
import type { Character, Shot } from '../types';
import { SHOT_PRESETS, DRAMA_TEMPLATES } from '../utils/presets';
import { generateSceneImage, subscribeCooldown } from '../utils/imageApi';
import './ScriptPage.less';

interface Props {
  character: Character;
  shots: Shot[];
  onShotsChange: (shots: Shot[]) => void;
  onGenerate: () => void;
  onBack: () => void;
}

function makeShot(prompt = ''): Shot {
  return { id: crypto.randomUUID(), prompt, status: 'idle' };
}

function buildImagePrompt(userPrompt: string, character: Character): string {
  const parts: string[] = [];
  if (character.avatar_describe) parts.push(character.avatar_describe);
  if (character.style) parts.push(`${character.style} style`);
  parts.push('cinematic film');
  parts.push(userPrompt);
  return parts.join(', ');
}

type FrameState = 'idle' | 'queued' | 'generating';
interface FrameLoadingState { start: FrameState; end: FrameState; }

function frameLabel(state: FrameState, hasImage: boolean, cooldownLeft: number): string {
  if (state === 'generating') return '生成中…';
  if (state === 'queued') return cooldownLeft > 0 ? `冷却 ${cooldownLeft}s` : '排队中…';
  return hasImage ? '重新生成' : '生成首帧';
}

function endFrameLabel(state: FrameState, hasImage: boolean, cooldownLeft: number): string {
  if (state === 'generating') return '生成中…';
  if (state === 'queued') return cooldownLeft > 0 ? `冷却 ${cooldownLeft}s` : '排队中…';
  return hasImage ? '重新生成' : '+ 尾帧';
}

export default function ScriptPage({ character, shots, onShotsChange, onGenerate, onBack }: Props) {
  const [showPresets, setShowPresets] = useState(false);
  const [frameLoading, setFrameLoading] = useState<Record<string, FrameLoadingState>>({});
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // Subscribe to global image API cooldown
  useEffect(() => subscribeCooldown(setCooldownLeft), []);

  const setFrameState = (id: string, type: 'start' | 'end', state: FrameState) => {
    setFrameLoading(prev => ({ ...prev, [id]: { ...prev[id], [type]: state } }));
  };

  const updatePrompt = (id: string, prompt: string) => {
    onShotsChange(shots.map(s => s.id === id
      ? { ...s, prompt, startImageUrl: undefined, endImageUrl: undefined }
      : s));
  };

  const generateFrameFor = (
    shot: Shot,
    currentShots: Shot[],
    type: 'start' | 'end',
    signal: { cancelled: boolean },
  ) => {
    if (!shot.prompt.trim() || signal.cancelled) return;

    const prompt = buildImagePrompt(shot.prompt, character);
    const urlKey = type === 'start' ? 'startImageUrl' : 'endImageUrl';

    generateSceneImage(
      prompt,
      character.head_url,
      () => { if (!signal.cancelled) setFrameState(shot.id, type, 'queued'); },
      () => { if (!signal.cancelled) setFrameState(shot.id, type, 'generating'); },
    ).then(url => {
      if (signal.cancelled) return;
      onShotsChange(currentShots.map(s => s.id === shot.id ? { ...s, [urlKey]: url } : s));
    }).catch(() => {
      // silently fail — user can retry
    }).finally(() => {
      if (!signal.cancelled) setFrameState(shot.id, type, 'idle');
    });
  };

  const generateFrame = (shot: Shot, type: 'start' | 'end') => {
    generateFrameFor(shot, shots, type, { cancelled: false });
  };

  // Auto-generate start frames for pre-filled shots on mount (StrictMode-safe)
  useEffect(() => {
    const signal = { cancelled: false };
    shots.filter(s => s.prompt.trim() && !s.startImageUrl)
      .forEach(shot => generateFrameFor(shot, shots, 'start', signal));
    return () => { signal.cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate when template applied (shot ids change)
  useEffect(() => {
    const signal = { cancelled: false };
    const toGen = shots.filter(s => s.prompt.trim() && !s.startImageUrl
      && (!frameLoading[s.id] || frameLoading[s.id].start === 'idle'));
    if (toGen.length === 0) return;
    toGen.forEach(shot => generateFrameFor(shot, shots, 'start', signal));
    return () => { signal.cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots.map(s => s.id).join(',')]);

  const addShot = () => {
    if (shots.length >= 5) return;
    onShotsChange([...shots, makeShot()]);
  };

  const removeShot = (id: string) => {
    if (shots.length <= 1) return;
    onShotsChange(shots.filter(s => s.id !== id));
  };

  const applyTemplate = (prompts: string[]) => {
    onShotsChange(prompts.map(p => makeShot(p)));
    setShowPresets(false);
  };

  const canGenerate = shots.some(s => s.prompt.trim().length > 0);
  const activeCount = shots.filter(s => s.prompt.trim()).length;
  const initials = character.name.slice(0, 2).toUpperCase();
  const anyLoading = Object.values(frameLoading).some(f => f?.start !== 'idle' || f?.end !== 'idle');

  return (
    <div className="ad-script">
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

      {/* Global cooldown banner */}
      {anyLoading && (
        <div className={`ad-cooldown-bar ${cooldownLeft > 0 ? 'ad-cooldown-bar--waiting' : ''}`}>
          {cooldownLeft > 0
            ? <><span className="ad-cooldown-bar__icon">⏳</span> 图片冷却中，{cooldownLeft}s 后继续排队</>
            : <><span className="ad-cooldown-bar__spinner" /> 正在生成画面…</>
          }
        </div>
      )}

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
          const loading = frameLoading[shot.id] ?? { start: 'idle', end: 'idle' };
          const hasPrompt = shot.prompt.trim().length > 0;
          const startBusy = loading.start !== 'idle';
          const endBusy = loading.end !== 'idle';
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
                <div className="ad-shot__frame">
                  {shot.startImageUrl
                    ? <img className="ad-shot__frame-img" src={shot.startImageUrl} alt="首帧" draggable={false} />
                    : <div className={`ad-shot__frame-empty ${startBusy ? 'ad-shot__frame-empty--loading' : ''}`}>
                        {startBusy ? <span className="ad-shot__frame-spinner" /> : '首帧'}
                      </div>
                  }
                  <button
                    className={`ad-shot__frame-btn ${loading.start === 'queued' ? 'ad-shot__frame-btn--queued' : ''}`}
                    onPointerDown={() => generateFrame(shot, 'start')}
                    disabled={!hasPrompt || startBusy}
                  >
                    {frameLabel(loading.start, !!shot.startImageUrl, cooldownLeft)}
                  </button>
                </div>

                <div className="ad-shot__frame">
                  {shot.endImageUrl
                    ? <img className="ad-shot__frame-img" src={shot.endImageUrl} alt="尾帧" draggable={false} />
                    : <div className={`ad-shot__frame-empty ad-shot__frame-empty--dim ${endBusy ? 'ad-shot__frame-empty--loading' : ''}`}>
                        {endBusy ? <span className="ad-shot__frame-spinner" /> : '尾帧（可选）'}
                      </div>
                  }
                  <button
                    className={`ad-shot__frame-btn ad-shot__frame-btn--dim ${loading.end === 'queued' ? 'ad-shot__frame-btn--queued' : ''}`}
                    onPointerDown={() => generateFrame(shot, 'end')}
                    disabled={!hasPrompt || endBusy}
                  >
                    {endFrameLabel(loading.end, !!shot.endImageUrl, cooldownLeft)}
                  </button>
                </div>
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
          onPointerDown={onGenerate}
          disabled={!canGenerate}
        >
          开拍！生成 {activeCount} 个镜头
        </button>
      </div>
    </div>
  );
}
