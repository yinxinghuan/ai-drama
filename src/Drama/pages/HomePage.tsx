import { useState } from 'react';
import { t } from '../i18n';
import type { Character, DramaTemplate, TemplateCategory } from '../types';
import type { AigramState } from '../hooks/useAigram';
import { DRAMA_TEMPLATES, TEMPLATE_CATEGORIES } from '../utils/presets';
import CharacterSelect from '../components/CharacterSelect';
import freeCreateCover from '../img/templates/free_create.jpg';
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
          <span>{t('home.genBanner')}</span>
        </div>
      )}

      <div className="ad-home__header">
        <div className="ad-home__logo">
          <div className="ad-home__logo-mark">Ai</div>
          <span className="ad-home__logo-text">{t('app.title')}</span>
        </div>
        <button className="ad-home__works-btn" onPointerDown={onOpenWorks}>{t('app.myWorks')}</button>
      </div>

      <div className="ad-home__hero" onClick={onFreeCreate}>
        <div
          className="ad-home__hero-avatar"
          onClick={(e) => { e.stopPropagation(); setShowCharSelect(true); }}
        >
          {defaultCharacter?.head_url
            ? <img src={defaultCharacter.head_url} alt={defaultCharacter.name} draggable={false} />
            : <span>{charInitials}</span>}
        </div>
        <div className="ad-home__hero-content">
          <div className="ad-home__hero-label">{t('home.director')}</div>
          <div className="ad-home__hero-title">{t('home.heroTitle')}</div>
          <div className="ad-home__hero-sub">{t('home.heroSub')}</div>
          <div className="ad-home__hero-cta">{t('home.freeCreate')} →</div>
        </div>
      </div>

      <div className="ad-home__section">
        <span className="ad-home__section-title">{t('home.inspiration')}</span>
      </div>

      <div className="ad-home__tabs">
        {TEMPLATE_CATEGORIES.map(cat => (
          <button
            key={cat.key}
            className={`ad-home__tab${activeTab === cat.key ? ' ad-home__tab--active' : ''}`}
            onClick={() => setActiveTab(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="ad-home__scroll">
        <div className="ad-home__grid">
          <div className="ad-home__card" onClick={onFreeCreate}>
            <img className="ad-home__card-img" src={freeCreateCover} alt="Free Create" draggable={false} />
            <div className="ad-home__card-overlay">
              <div className="ad-home__card-title">{t('home.freeCreate')}</div>
            </div>
          </div>

          {filtered.map(tmpl => (
            <div
              key={tmpl.id}
              className="ad-home__card"
              onClick={() => onSelectTemplate(tmpl)}
            >
              {tmpl.preview
                ? <img className="ad-home__card-img" src={tmpl.preview} alt={tmpl.label} draggable={false} />
                : <div className="ad-home__card-placeholder">{tmpl.label.slice(0, 2)}</div>}
              <div className="ad-home__card-overlay">
                <div className="ad-home__card-title">{tmpl.label}</div>
                <div className="ad-home__card-cat">{tmpl.category}</div>
              </div>
            </div>
          ))}
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
