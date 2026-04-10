import { useState, useEffect } from 'react';
import { t } from '../i18n';
import type { Work } from '../types';
import { loadWorksLocal, loadWorksRemote, deleteWork } from '../utils/works';
import './WorksPage.less';

interface Props {
  uid?: string;
  onBack: () => void;
  onOpen: (work: Work) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function WorksPage({ uid, onBack, onOpen }: Props) {
  const [works, setWorks] = useState<Work[]>(() => loadWorksLocal());
  const [loading, setLoading] = useState(!!uid);

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

  return (
    <div className="ad-works">
      <div className="ad-works__header">
        <button className="ad-works__back" onPointerDown={onBack}>←</button>
        <span className="ad-works__title">{t('app.myWorks')}</span>
      </div>

      {loading ? (
        <div className="ad-works__loading">{t('works.loading')}</div>
      ) : works.length === 0 ? (
        <div className="ad-works__empty">
          <p>{t('works.empty')}</p>
          <p className="ad-works__empty-sub">{t('works.emptyDesc')}</p>
        </div>
      ) : (
        <div className="ad-works__list">
          {works.map(work => {
            const videoCount = work.shots.filter(s => s.videoUrl).length;
            const pendingCount = work.shots.filter(s => s.taskId && !s.videoUrl).length;
            const firstShot = work.shots.find(s => s.videoUrl);
            const firstVideo = firstShot?.videoUrl;
            const thumbPoster = firstShot?.startImageUrl;
            return (
              <div key={work.id} className="ad-work-card" onClick={() => onOpen(work)}>
                {/* Thumbnail */}
                <div className="ad-work-card__thumb">
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
                  <span className="ad-work-card__meta">
                    {videoCount > 0
                      ? <>{videoCount} {t('works.shotsCompleted')}</>
                      : <span className="ad-work-card__pending">{t('works.inProgress')}</span>
                    }
                    {pendingCount > 0 && <span className="ad-work-card__pending"> · {pendingCount} {t('works.pending')}</span>}
                    {' · '}{formatDate(work.createdAt)}
                  </span>

                  <div className="ad-work-card__actions">
                    <button
                      className="ad-work-card__btn ad-work-card__btn--del"
                      onClick={e => { e.stopPropagation(); handleDelete(work.id); }}
                    >{t('works.delete')}</button>
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
