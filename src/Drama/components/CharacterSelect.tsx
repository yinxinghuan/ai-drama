import { useState } from 'react';
import { t } from '../i18n';
import type { Character } from '../types';
import { sfxTap, sfxConfirm, sfxNav } from '../utils/sounds';
import './CharacterSelect.less';

const NO_CHAR: Character = {
  telegram_id: '__none__',
  name: '',
  head_url: '',
};

interface Props {
  characters: Character[];
  current: Character | null;
  onPick: (char: Character) => void;
  onClose: () => void;
}

export default function CharacterSelect({ characters, current, onPick, onClose }: Props) {
  const [pendingId, setPendingId] = useState<string>(current?.telegram_id ?? '');
  const isNone = pendingId === '__none__';
  const pendingChar = isNone ? NO_CHAR : (characters.find(c => c.telegram_id === pendingId) ?? current);
  const isChanged = pendingId !== (current?.telegram_id ?? '');

  function handleSelect(id: string) {
    if (id !== pendingId) { sfxTap(); setPendingId(id); }
  }

  function handleConfirm() {
    if (pendingChar && isChanged) { sfxConfirm(); onPick(pendingChar); }
  }

  return (
    <div className="ad-charsel">
      <div className="ad-charsel__overlay" onPointerDown={() => { sfxNav(); onClose(); }} />
      <div className="ad-charsel__dialog">
        <div className="ad-charsel__title">{t('charsel.title')}</div>

        <div className="ad-charsel__body">
          <div className="ad-charsel__list">
            {/* No character option */}
            <div
              className={[
                'ad-charsel__item',
                !current ? 'ad-charsel__item--active' : '',
                isNone && isChanged ? 'ad-charsel__item--pending' : '',
              ].join(' ').trim()}
              onPointerDown={() => handleSelect('__none__')}
            >
              <div className="ad-charsel__avatar ad-charsel__avatar--none">
                <span className="ad-charsel__initials">✦</span>
              </div>
              <div className="ad-charsel__name-col">
                <div className="ad-charsel__name">{t('charsel.noChar')}</div>
                <div className="ad-charsel__desc">{t('charsel.noCharDesc')}</div>
              </div>
              {!current && <div className="ad-charsel__check">✓</div>}
            </div>

            {characters.map(char => {
              const isConfirmed = char.telegram_id === (current?.telegram_id ?? '');
              const isPending = char.telegram_id === pendingId && isChanged;
              const initials = char.name.slice(0, 2).toUpperCase() || '?';
              return (
                <div
                  key={char.telegram_id}
                  className={[
                    'ad-charsel__item',
                    isConfirmed ? 'ad-charsel__item--active' : '',
                    isPending ? 'ad-charsel__item--pending' : '',
                  ].join(' ').trim()}
                  onPointerDown={() => handleSelect(char.telegram_id)}
                >
                  <div className="ad-charsel__avatar">
                    {char.head_url
                      ? <img src={char.head_url} alt={char.name} draggable={false} />
                      : <span className="ad-charsel__initials">{initials}</span>}
                  </div>
                  <div className="ad-charsel__name">{char.name}</div>
                  {isConfirmed && <div className="ad-charsel__check">✓</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="ad-charsel__footer">
          <button
            className={`ad-charsel__confirm${isChanged ? '' : ' ad-charsel__confirm--disabled'}`}
            onPointerDown={isChanged ? handleConfirm : undefined}
          >
            {isChanged
              ? `${t('charsel.confirm')}: ${isNone ? t('charsel.noChar') : (pendingChar?.name ?? '')}`
              : t('charsel.confirmed')}
          </button>
        </div>
      </div>
    </div>
  );
}
