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
        <img src="/ai-drama/img/aigram.svg" className="ad-home__logo" alt="aigram" />
        <span className="ad-home__title">{t('app.title')}</span>
        <button className="ad-home__works-btn" onPointerDown={onOpenWorks}>{t('app.myWorks')}</button>
      </div>

      <div className="ad-home__char-row" onClick={() => setShowCharSelect(true)}>
        <div className="ad-home__char-avatar">
          {defaultCharacter?.head_url
            ? <img src={defaultCharacter.head_url} alt={defaultCharacter.name} draggable={false} />
            : <span>{charInitials}</span>}
        </div>
        <span className="ad-home__char-name">
          {defaultCharacter?.name || t('home.selectChar')}
        </span>
        <span className="ad-home__char-hint">{t('home.defaultChar')}</span>
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
        <div className="ad-home__card" onClick={onFreeCreate}>
          <img className="ad-home__card-img" src={freeCreateCover} alt="自由创作" draggable={false} />
          <div className="ad-home__card-info">
            <span className="ad-home__card-label">{t('home.freeCreate')}</span>
            <span className="ad-home__card-desc">{t('home.freeCreateDesc')}</span>
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
              : <div className="ad-home__card-placeholder">{tmpl.label}</div>}
            <div className="ad-home__card-info">
              <span className="ad-home__card-label">{tmpl.label}</span>
              <span className="ad-home__card-desc">{tmpl.shots[0]}</span>
            </div>
          </div>
        ))}
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
