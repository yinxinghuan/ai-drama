import { useState } from 'react';
import type { Character, Shot } from '../types';
import { SHOT_PRESETS, DRAMA_TEMPLATES } from '../utils/presets';
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

export default function ScriptPage({ character, shots, onShotsChange, onGenerate, onBack }: Props) {
  const [showPresets, setShowPresets] = useState(false);

  const updatePrompt = (id: string, prompt: string) => {
    onShotsChange(shots.map(s => s.id === id ? { ...s, prompt } : s));
  };

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

  const canGenerate = shots.every(s => s.prompt.trim().length > 0);
  const initials = character.name.slice(0, 2).toUpperCase();

  return (
    <div className="ad-script">
      {/* Header */}
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

      {/* Template picker */}
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

      {/* Shot cards */}
      <div className="ad-shots">
        {shots.map((shot, i) => (
          <div key={shot.id} className="ad-shot">
            <div className="ad-shot__num">镜头 {i + 1}</div>
            <textarea
              className="ad-shot__input"
              value={shot.prompt}
              onChange={e => updatePrompt(shot.id, e.target.value)}
              placeholder="描述这个镜头的场景…"
              rows={2}
            />
            {/* Preset hints */}
            <div className="ad-shot__hints">
              {SHOT_PRESETS.slice(i * 2, i * 2 + 2).map(p => (
                <span
                  key={p}
                  className="ad-shot__hint"
                  onPointerDown={() => updatePrompt(shot.id, p)}
                >
                  {p}
                </span>
              ))}
            </div>
            {shots.length > 1 && (
              <button className="ad-shot__remove" onPointerDown={() => removeShot(shot.id)}>✕</button>
            )}
          </div>
        ))}

        {shots.length < 5 && (
          <button className="ad-add-shot" onPointerDown={addShot}>
            + 添加镜头（{shots.length}/5）
          </button>
        )}
      </div>

      {/* Generate */}
      <div className="ad-script__footer">
        <button
          className="ad-generate-btn"
          onPointerDown={onGenerate}
          disabled={!canGenerate}
        >
          开拍！生成 {shots.length} 个镜头
        </button>
      </div>
    </div>
  );
}
