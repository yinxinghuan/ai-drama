import { useState, useEffect } from 'react';
import type { Character, Shot } from '../types';
import { SHOT_PRESETS, DRAMA_TEMPLATES } from '../utils/presets';
import { generateSceneImage } from '../utils/imageApi';
import './ScriptPage.less';

type ShotsUpdater = (shots: Shot[]) => void;

interface Props {
  character: Character;
  shots: Shot[];
  onShotsChange: ShotsUpdater;
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

interface FrameLoadingState { start: boolean; end: boolean; }

export default function ScriptPage({ character, shots, onShotsChange, onGenerate, onBack }: Props) {
  const [showPresets, setShowPresets] = useState(false);
  const [frameLoading, setFrameLoading] = useState<Record<string, FrameLoadingState>>({});


  const updatePrompt = (id: string, prompt: string) => {
    onShotsChange(shots.map(s => s.id === id
      ? { ...s, prompt, startImageUrl: undefined, endImageUrl: undefined }
      : s));
  };

  // Safe async frame generator — takes a latest-shots snapshot to avoid stale closure
  const generateFrameFor = async (
    shot: Shot,
    currentShots: Shot[],
    type: 'start' | 'end',
    signal: { cancelled: boolean },
  ) => {
    if (!shot.prompt.trim() || signal.cancelled) return;
    setFrameLoading(prev => ({ ...prev, [shot.id]: { ...prev[shot.id], [type]: true } }));
    try {
      const prompt = buildImagePrompt(shot.prompt, character);
      const url = await generateSceneImage(prompt, character.head_url);
      if (signal.cancelled) return;
      onShotsChange(currentShots.map(s => s.id === shot.id
        ? { ...s, [type === 'start' ? 'startImageUrl' : 'endImageUrl']: url }
        : s));
    } catch {
      // silently fail — user can retry
    } finally {
      if (!signal.cancelled) {
        setFrameLoading(prev => ({ ...prev, [shot.id]: { ...prev[shot.id], [type]: false } }));
      }
    }
  };

  // Wrapper for manual button clicks
  const generateFrame = (shot: Shot, type: 'start' | 'end') => {
    generateFrameFor(shot, shots, type, { cancelled: false });
  };

  // Auto-generate start frames for pre-filled shots on mount
  // Uses cleanup to handle React StrictMode double-invoke correctly
  useEffect(() => {
    const signal = { cancelled: false };
    const toGenerate = shots.filter(s => s.prompt.trim() && !s.startImageUrl);
    toGenerate.forEach(shot => generateFrameFor(shot, shots, 'start', signal));
    return () => { signal.cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate when template is applied (new shots with prompts but no images)
  useEffect(() => {
    const signal = { cancelled: false };
    const toGenerate = shots.filter(s => s.prompt.trim() && !s.startImageUrl && !frameLoading[s.id]?.start);
    if (toGenerate.length === 0) return;
    toGenerate.forEach(shot => generateFrameFor(shot, shots, 'start', signal));
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
          const loading = frameLoading[shot.id] || { start: false, end: false };
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
                <div className="ad-shot__frame">
                  {shot.startImageUrl
                    ? <img className="ad-shot__frame-img" src={shot.startImageUrl} alt="首帧" draggable={false} />
                    : <div className="ad-shot__frame-empty">
                        {loading.start ? <span className="ad-shot__frame-spinner" /> : '首帧'}
                      </div>
                  }
                  <button
                    className="ad-shot__frame-btn"
                    onPointerDown={() => generateFrame(shot, 'start')}
                    disabled={!hasPrompt || loading.start}
                  >
                    {loading.start ? '生成中…' : shot.startImageUrl ? '重新生成' : '生成首帧'}
                  </button>
                </div>

                <div className="ad-shot__frame">
                  {shot.endImageUrl
                    ? <img className="ad-shot__frame-img" src={shot.endImageUrl} alt="尾帧" draggable={false} />
                    : <div className="ad-shot__frame-empty ad-shot__frame-empty--dim">
                        {loading.end ? <span className="ad-shot__frame-spinner" /> : '尾帧（可选）'}
                      </div>
                  }
                  <button
                    className="ad-shot__frame-btn ad-shot__frame-btn--dim"
                    onPointerDown={() => generateFrame(shot, 'end')}
                    disabled={!hasPrompt || loading.end}
                  >
                    {loading.end ? '生成中…' : shot.endImageUrl ? '重新生成' : '+ 尾帧'}
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
