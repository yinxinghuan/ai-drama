import { useState } from 'react';
import type { Character, DramaTemplate, TemplateCategory } from '../types';
import type { AigramState } from '../hooks/useAigram';
import { DRAMA_TEMPLATES, TEMPLATE_CATEGORIES } from '../utils/presets';
import CharacterSelect from '../components/CharacterSelect';
import './HomePage.less';

interface Props {
  aigram: AigramState;
  defaultCharacter: Character | null;
  onSelectTemplate: (template: DramaTemplate) => void;
  onFreeCreate: () => void;
  onOpenWorks: () => void;
  onChangeDefaultCharacter: (char: Character) => void;
  isGenerating?: boolean;
  onResumeGenerating?: () => void;
}

export default function HomePage({
  aigram,
  defaultCharacter,
  onSelectTemplate,
  onFreeCreate,
  onOpenWorks,
  onChangeDefaultCharacter,
  isGenerating,
  onResumeGenerating,
}: Props) {
  const [activeTab, setActiveTab] = useState<TemplateCategory>('all');
  const [showCharSelect, setShowCharSelect] = useState(false);

  const filtered = activeTab === 'all'
    ? DRAMA_TEMPLATES
    : DRAMA_TEMPLATES.filter(t => t.category === activeTab);

  const { me, contacts } = aigram;
  const allChars: Character[] = [];
  if (me) allChars.push(me);
  contacts.forEach(c => { if (c.telegram_id !== me?.telegram_id) allChars.push(c); });

  const charInitials = defaultCharacter?.name.slice(0, 2).toUpperCase() || '?';

  return (
    <div className="ad-home">
      {isGenerating && (
        <div className="ad-home__gen-banner" onPointerDown={onResumeGenerating}>
          <span className="ad-home__gen-spinner" />
          <span>拍摄进行中… 点击查看进度</span>
        </div>
      )}

      <div className="ad-home__header">
        <img src="/ai-drama/img/aigram.svg" className="ad-home__logo" alt="aigram" />
        <span className="ad-home__title">AI 短剧导演</span>
        <button className="ad-home__works-btn" onPointerDown={onOpenWorks}>我的作品</button>
      </div>

      <div className="ad-home__char-row" onPointerDown={() => setShowCharSelect(true)}>
        <div className="ad-home__char-avatar">
          {defaultCharacter?.head_url
            ? <img src={defaultCharacter.head_url} alt={defaultCharacter.name} draggable={false} />
            : <span>{charInitials}</span>}
        </div>
        <span className="ad-home__char-name">
          {defaultCharacter?.name || '选择角色'}
        </span>
        <span className="ad-home__char-hint">默认角色 ›</span>
      </div>

      <div className="ad-home__tabs">
        {TEMPLATE_CATEGORIES.map(cat => (
          <button
            key={cat.key}
            className={`ad-home__tab${activeTab === cat.key ? ' ad-home__tab--active' : ''}`}
            onPointerDown={() => setActiveTab(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="ad-home__grid">
        {filtered.map(tmpl => (
          <div
            key={tmpl.id}
            className="ad-home__card"
            onPointerDown={() => onSelectTemplate(tmpl)}
          >
            {tmpl.preview
              ? <img className="ad-home__card-img" src={tmpl.preview} alt={tmpl.label} draggable={false} />
              : <div className="ad-home__card-placeholder">{tmpl.label}</div>}
            <div className="ad-home__card-info">
              <span className="ad-home__card-label">{tmpl.label}</span>
              <span className="ad-home__card-desc">{tmpl.shots[0]}</span>
            </div>
          </div>
        ))}

        <div className="ad-home__card ad-home__card--free" onPointerDown={onFreeCreate}>
          <div className="ad-home__card-placeholder ad-home__card-placeholder--free">
            <span className="ad-home__free-icon">✦</span>
            <span>自由创作</span>
          </div>
          <div className="ad-home__card-info">
            <span className="ad-home__card-label">✦ 自由创作</span>
            <span className="ad-home__card-desc">从零开始，写你自己的剧本</span>
          </div>
        </div>
      </div>

      {showCharSelect && allChars.length > 0 && (
        <CharacterSelect
          characters={allChars}
          current={defaultCharacter}
          onPick={(char) => { onChangeDefaultCharacter(char); setShowCharSelect(false); }}
          onClose={() => setShowCharSelect(false)}
        />
      )}
    </div>
  );
}
