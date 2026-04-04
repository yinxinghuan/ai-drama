import { useState, useEffect } from 'react';
import type { Work } from '../types';
import { loadWorksLocal, loadWorksRemote, deleteWork } from '../utils/works';
import './WorksPage.less';

interface Props {
  uid?: string;
  onBack: () => void;
  onPlay: (work: Work) => void;
  onEdit: (work: Work) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function WorksPage({ uid, onBack, onPlay, onEdit }: Props) {
  const [works, setWorks] = useState<Work[]>(() => loadWorksLocal());
  const [loading, setLoading] = useState(!!uid);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  // Load from cloud when uid is available
  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    loadWorksRemote(uid)
      .then(setWorks)
      .catch(() => setWorks(loadWorksLocal())) // fallback to local on error
      .finally(() => setLoading(false));
  }, [uid]);

  const handleDelete = async (id: string) => {
    setWorks(prev => prev.filter(w => w.id !== id));
    try {
      await deleteWork(uid, id);
    } catch {
      // best-effort; UI already updated
    }
  };

  const handleShare = (work: Work) => {
    const videos = work.shots.filter(s => s.videoUrl).map(s => s.videoUrl!);
    if (videos.length === 0) return;
    const text = videos.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyHint(work.id);
      setTimeout(() => setCopyHint(null), 2000);
    });
  };

  return (
    <div className="ad-works">
      <div className="ad-works__header">
        <button className="ad-works__back" onPointerDown={onBack}>←</button>
        <span className="ad-works__title">我的作品</span>
      </div>

      {loading ? (
        <div className="ad-works__loading">加载中…</div>
      ) : works.length === 0 ? (
        <div className="ad-works__empty">
          <p>还没有作品</p>
          <p className="ad-works__empty-sub">生成第一部短剧吧</p>
        </div>
      ) : (
        <div className="ad-works__list">
          {works.map(work => {
            const videoCount = work.shots.filter(s => s.videoUrl).length;
            const firstShot = work.shots.find(s => s.videoUrl);
            const firstVideo = firstShot?.videoUrl;
            const thumbPoster = firstShot?.startImageUrl;
            return (
              <div key={work.id} className="ad-work-card">
                {/* Thumbnail */}
                <div className="ad-work-card__thumb" onPointerDown={() => onPlay(work)}>
                  {firstVideo
                    ? <video src={firstVideo} poster={thumbPoster} playsInline muted preload="metadata" />
                    : <div className="ad-work-card__thumb-empty">▶</div>
                  }
                  <div className="ad-work-card__play-icon">▶</div>
                </div>

                {/* Info */}
                <div className="ad-work-card__info">
                  <div className="ad-work-card__char">
                    <div className="ad-work-card__avatar">
                      {work.character.head_url
                        ? <img src={work.character.head_url} alt={work.character.name} draggable={false} />
                        : <span>{work.character.name.slice(0, 2)}</span>}
                    </div>
                    <span className="ad-work-card__name">{work.character.name}</span>
                  </div>
                  <span className="ad-work-card__meta">{videoCount} 个镜头 · {formatDate(work.createdAt)}</span>

                  <div className="ad-work-card__actions">
                    <button className="ad-work-card__btn" onPointerDown={() => onEdit(work)}>重新编辑</button>
                    <button
                      className="ad-work-card__btn ad-work-card__btn--share"
                      onPointerDown={() => handleShare(work)}
                    >
                      {copyHint === work.id ? '已复制 ✓' : '复制链接'}
                    </button>
                    <button className="ad-work-card__btn ad-work-card__btn--del" onPointerDown={() => handleDelete(work.id)}>删除</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
