import { useState, useEffect, useCallback } from 'react';
import { t } from '../i18n';
import type { Work } from '../types';
import { loadWorksLocal, loadWorksRemote, deleteWork } from '../utils/works';
import { sfxTap, sfxNav, sfxWarn, sfxSuccess } from '../utils/sounds';
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

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleShare = useCallback((workId: string) => {
    const base = window.location.origin + '/ai-drama/';
    const url = `${base}?work=${workId}`;
    navigator.clipboard.writeText(url).then(() => {
      sfxSuccess();
      setCopiedId(workId);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  }, []);

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
        <button className="ad-works__back" onPointerDown={() => { sfxNav(); onBack(); }}>←</button>
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
            const totalCount = work.shots.length;
            const firstShot = work.shots.find(s => s.videoUrl);
            const firstVideo = firstShot?.videoUrl;
            const thumbPoster = firstShot?.startImageUrl;
            const isDone = videoCount > 0 && pendingCount === 0;
            const isInProgress = pendingCount > 0 || work.shots.some(s => ['imaging', 'waiting', 'generating'].includes(s.status));
            return (
              <div key={work.id} className="ad-work-card" onClick={() => onOpen(work)}>
                {/* Cover */}
                <div className="ad-work-card__cover">
                  {firstVideo
                    ? <video className="ad-work-card__cover-video" src={firstVideo} poster={thumbPoster} playsInline muted preload="metadata" />
                    : <div style={{ position: 'absolute', inset: 0, background: '#1a1a1a' }} />
                  }
                  <div className="ad-work-card__play">
                    <div className="ad-work-card__play-icon">{isInProgress ? '⟳' : '▶'}</div>
                  </div>
                  {isDone && (
                    <div className="ad-work-card__badge ad-work-card__badge--done">
                      {videoCount} {t('works.shotsCompleted')}
                    </div>
                  )}
                  {isInProgress && (
                    <div className="ad-work-card__badge ad-work-card__badge--progress">
                      {t('works.inProgress')} {videoCount}/{totalCount}
                    </div>
                  )}
                  {isInProgress && (
                    <div className="ad-work-card__progress">
                      <div className="ad-work-card__progress-fill" style={{ width: `${(videoCount / totalCount) * 100}%` }} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="ad-work-card__info">
                  <div className="ad-work-card__meta">
                    <div className="ad-work-card__avatar">
                      {work.character.head_url
                        ? <img src={work.character.head_url} alt={work.character.name} draggable={false} />
                        : <span>{work.character.name.slice(0, 2)}</span>}
                    </div>
                    <div className="ad-work-card__meta-text">
                      <span className="ad-work-card__name">{work.character.name}</span>
                      <span className="ad-work-card__detail">{formatDate(work.createdAt)}</span>
                    </div>
                  </div>

                  <div className="ad-work-card__actions">
                    {isDone && (
                      <button
                        className={`ad-work-card__btn ad-work-card__btn--share${copiedId === work.id ? ' ad-work-card__btn--copied' : ''}`}
                        onClick={e => { e.stopPropagation(); sfxTap(); handleShare(work.id); }}
                      >{copiedId === work.id ? `✓ ${t('works.copied')}` : `↗ ${t('works.share')}`}</button>
                    )}
                    <button
                      className="ad-work-card__btn ad-work-card__btn--del"
                      onClick={e => { e.stopPropagation(); sfxWarn(); handleDelete(work.id); }}
                    >✕ {t('works.delete')}</button>
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
