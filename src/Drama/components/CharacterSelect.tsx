import { useState } from 'react';
import type { Character } from '../types';
import './CharacterSelect.less';

interface Props {
  characters: Character[];
  current: Character | null;
  onPick: (char: Character) => void;
  onClose: () => void;
}

export default function CharacterSelect({ characters, current, onPick, onClose }: Props) {
  const [pendingId, setPendingId] = useState<string>(current?.telegram_id ?? '');
  const pendingChar = characters.find(c => c.telegram_id === pendingId) ?? current;
  const isChanged = pendingId !== (current?.telegram_id ?? '');

  function handleSelect(char: Character) {
    if (char.telegram_id !== pendingId) {
      setPendingId(char.telegram_id);
    }
  }

  function handleConfirm() {
    if (pendingChar) onPick(pendingChar);
  }

  return (
    <div className="ad-charsel">
      <div className="ad-charsel__overlay" onPointerDown={onClose} />
      <div className="ad-charsel__dialog">
        <div className="ad-charsel__title">选择角色</div>

        <div className="ad-charsel__body">
          <div className="ad-charsel__list">
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
                  onPointerDown={() => handleSelect(char)}
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
            {isChanged ? `确认: ${pendingChar?.name ?? ''}` : '✓ 已选定'}
          </button>
        </div>
      </div>
    </div>
  );
}
