import { useState } from 'react';
import type { Character } from '../types';
import type { AigramState } from '../hooks/useAigram';
import './SetupPage.less';

interface Props {
  aigram: AigramState;
  onSelect: (character: Character) => void;
  onOpenWorks: () => void;
}

function CharCard({ char, isMe, onSelect }: { char: Character; isMe: boolean; onSelect: () => void }) {
  const initials = char.name.slice(0, 2).toUpperCase() || '?';
  return (
    <div
      className={`ad-char-card${isMe ? ' ad-char-card--me' : ''}`}
      onPointerDown={onSelect}
    >
      <div className="ad-char-card__img">
        {char.head_url
          ? <img src={char.head_url} alt={char.name} draggable={false} />
          : <span className="ad-char-card__initials">{initials}</span>
        }
        {isMe && <span className="ad-char-card__tag">主角</span>}
      </div>
      <div className="ad-char-card__name">{char.name || '你'}</div>
    </div>
  );
}

export default function SetupPage({ aigram, onSelect, onOpenWorks }: Props) {
  const { me, contacts, loading, isDemo } = aigram;
  const [username, setUsername] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<Character | null>(null);
  const [searchError, setSearchError] = useState('');

  const handleSearch = async () => {
    if (!username.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    try {
      const res = await fetch(`http://api.wdabuliu.com/note/telegram/user/get/one/by/name?name=${encodeURIComponent(username.trim())}`);
      const json = await res.json() as { retcode: number; data?: { telegram_id: string; name: string; head_url: string; avatar_describe?: string; style?: string } };
      if (json.retcode === 0 && json.data) {
        setSearchResult({ telegram_id: json.data.telegram_id, name: json.data.name, head_url: json.data.head_url, avatar_describe: json.data.avatar_describe, style: json.data.style });
      } else {
        setSearchError('找不到该用户');
      }
    } catch {
      setSearchError('查询失败，请重试');
    } finally {
      setSearching(false);
    }
  };

  const all: Character[] = contacts.filter(c => c.name !== '你');

  return (
    <div className="ad-setup">
      <div className="ad-setup__header">
        <img src="/ai-drama/img/aigram.svg" className="ad-setup__logo" alt="aigram" />
        <span className="ad-setup__title">AI 短剧导演</span>
        <span className="ad-setup__sub">选择主角</span>
        <button className="ad-setup__works-btn" onPointerDown={onOpenWorks}>我的作品</button>
      </div>

      {loading ? (
        <div className="ad-setup__loading">加载中…</div>
      ) : (
        <>
          {/* Demo 模式：用户名搜索 */}
          {isDemo && (
            <div className="ad-setup__search">
              <div className="ad-setup__search-row">
                <input
                  className="ad-setup__search-input"
                  placeholder="输入你的 Aigram 用户名"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <button
                  className="ad-setup__search-btn"
                  onPointerDown={handleSearch}
                  disabled={searching || !username.trim()}
                >
                  {searching ? '…' : '查找'}
                </button>
              </div>
              {searchError && <p className="ad-setup__search-error">{searchError}</p>}
              {searchResult && (
                <div className="ad-setup__search-result" onPointerDown={() => onSelect(searchResult)}>
                  <CharCard char={searchResult} isMe={true} onSelect={() => onSelect(searchResult)} />
                </div>
              )}
            </div>
          )}

          {/* 好友列表 */}
          {all.length > 0 && (
            <>
              <p className="ad-setup__section-label">
                {isDemo ? '示例角色' : '选择主角'}
              </p>
              <div className="ad-setup__grid">
                {me && !isDemo && (
                  <CharCard char={me} isMe={true} onSelect={() => onSelect(me)} />
                )}
                {all.map(char => (
                  <CharCard key={char.telegram_id} char={char} isMe={false} onSelect={() => onSelect(char)} />
                ))}
                <CharCard
                  char={{ telegram_id: '__none__', name: '无主角', head_url: '' }}
                  isMe={false}
                  onSelect={() => onSelect({ telegram_id: '__none__', name: '无主角', head_url: '' })}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
