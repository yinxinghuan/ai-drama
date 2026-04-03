import type { Character } from '../types';
import type { AigramState } from '../hooks/useAigram';
import './SetupPage.less';

interface Props {
  aigram: AigramState;
  onSelect: (character: Character) => void;
}

function Avatar({ char }: { char: Character }) {
  const initials = char.name.slice(0, 2).toUpperCase();
  return (
    <div className="ad-avatar">
      {char.head_url
        ? <img src={char.head_url} alt={char.name} draggable={false} />
        : <span>{initials || '?'}</span>
      }
    </div>
  );
}

export default function SetupPage({ aigram, onSelect }: Props) {
  const { me, contacts, loading, isDemo } = aigram;
  const all: Character[] = me ? [me, ...contacts] : contacts;

  return (
    <div className="ad-setup">
      <div className="ad-setup__header">
        <img src="/ai-drama/img/aigram.svg" className="ad-setup__logo" alt="aigram" />
        <h1 className="ad-setup__title">AI 短剧导演</h1>
        <p className="ad-setup__sub">选择主角，开始你的短剧</p>
      </div>

      {loading ? (
        <div className="ad-setup__loading">加载角色中…</div>
      ) : (
        <>
          {isDemo && (
            <div className="ad-setup__demo-tip">演示模式 · 在 Aigram 中使用可加载真实好友</div>
          )}
          <div className="ad-setup__grid">
            {all.map((char, i) => (
              <div
                key={char.telegram_id}
                className={`ad-char-card${i === 0 ? ' ad-char-card--me' : ''}`}
                onPointerDown={() => onSelect(char)}
              >
                <Avatar char={char} />
                <span className="ad-char-card__name">
                  {i === 0 && me?.telegram_id === char.telegram_id ? '你' : char.name}
                </span>
                {i === 0 && me?.telegram_id === char.telegram_id && (
                  <span className="ad-char-card__tag">主角</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
