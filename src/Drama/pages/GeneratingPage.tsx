import { useState, useEffect, useMemo } from 'react';
import { t } from '../i18n';
import type { Shot } from '../types';
import { sfxTap, sfxConfirm, sfxNav } from '../utils/sounds';
import './GeneratingPage.less';

interface Props {
  shots: Shot[];
  onRegen: (shotId: string) => void;
  onContinue: () => void;
  onPreview: () => void;
  onBack: () => void;
}

export default function GeneratingPage({ shots, onRegen, onContinue, onPreview, onBack }: Props) {
  const active = shots.filter(s => s.prompt.trim());
  const doneCount = active.filter(s => s.status === 'done' || s.status === 'error').length;
  const allSettled = active.length > 0 && doneCount === active.length;
  const successShots = active.filter(s => s.status === 'done' && s.videoUrl);
  const isGenerating = active.some(s => ['imaging', 'waiting', 'generating'].includes(s.status));
  const hasRemaining = active.some(s => s.status === 'idle' || s.status === 'error');

  // Preload videos once all settled
  const [loadedCount, setLoadedCount] = useState(0);
  const allPreloaded = successShots.length > 0 && loadedCount >= successShots.length;

  // Single shot video preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Track which filmstrip cell is selected for the center preview
  const activeGeneratingIndex = useMemo(() => {
    const idx = active.findIndex(s => ['imaging', 'waiting', 'generating'].includes(s.status));
    return idx >= 0 ? idx : null;
  }, [active]);

  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Auto-follow the currently generating shot
  useEffect(() => {
    if (activeGeneratingIndex !== null) {
      setSelectedIndex(activeGeneratingIndex);
    }
  }, [activeGeneratingIndex]);

  // Collect video URLs for preloading — stable string key
  const videoUrls = successShots.map(s => s.videoUrl!).join(',');

  useEffect(() => {
    if (!allSettled || successShots.length === 0) return;
    setLoadedCount(0);
    let count = 0;
    const urls = videoUrls.split(',').filter(Boolean);
    urls.forEach(url => {
      const v = document.createElement('video');
      v.preload = 'auto';
      v.oncanplaythrough = () => { count++; setLoadedCount(count); };
      v.onerror = () => { count++; setLoadedCount(count); };
      v.src = url;
    });
  }, [allSettled, videoUrls]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = active.length > 0 ? Math.round((doneCount / active.length) * 100) : 0;
  const selectedShot = active[selectedIndex] ?? active[0];

  const padNum = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="ad-gen">
      <div className="ad-gen__header">
        <button className="ad-gen__back" onPointerDown={() => { sfxNav(); onBack(); }}>&larr;</button>
      </div>

      <div className="ad-gen__top">
        <div className="ad-gen__icon">🎬</div>
        <h2 className="ad-gen__title">{allSettled ? t('gen.done') : isGenerating ? t('gen.filming') : t('gen.overview')}</h2>
        {isGenerating && (
          <>
            <p className="ad-gen__sub">{t('gen.eta')}</p>
            <p className="ad-gen__tip">{t('gen.tip')}</p>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="ad-gen__bar-wrap">
        <div className="ad-gen__bar">
          <div className="ad-gen__bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="ad-gen__bar-label">{padNum(successShots.length)} / {padNum(active.length)}</div>
      </div>

      {/* Filmstrip row */}
      <div className="ad-gen__filmstrip">
        {active.map((shot, i) => {
          const isActive = ['imaging', 'waiting', 'generating'].includes(shot.status);
          const isDone = shot.status === 'done';
          const isError = shot.status === 'error';
          const cellClass = [
            'ad-gen__film-cell',
            isActive ? 'ad-gen__film-cell--active' : '',
            isDone ? 'ad-gen__film-cell--done' : '',
            isError ? 'ad-gen__film-cell--error' : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              key={shot.id}
              className={cellClass}
              onClick={() => {
                sfxTap();
                setSelectedIndex(i);
                if (isDone && shot.videoUrl) setPreviewUrl(shot.videoUrl);
              }}
            >
              {isDone && shot.startImageUrl ? (
                <>
                  <img className="ad-gen__film-thumb" src={shot.startImageUrl} draggable={false} />
                  <div className="ad-gen__film-check">✓</div>
                </>
              ) : isActive ? (
                <div className="ad-gen__film-spinner" />
              ) : (
                <span className="ad-gen__film-cell-num">{i + 1}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Center preview area */}
      {selectedShot && (
        <>
          <div className="ad-gen__preview">
            {['imaging', 'waiting', 'generating'].includes(selectedShot.status) ? (
              <div className="ad-gen__preview-inner">
                <span className="ad-gen__preview-shot-num">{String(selectedIndex + 1).padStart(2, '0')}</span>
                <div className="ad-gen__preview-spinner" />
                <div className="ad-gen__preview-text">
                  {selectedShot.status === 'imaging' && t('gen.imaging')}
                  {selectedShot.status === 'waiting' && `${t('gen.cooldown')} ${selectedShot.waitSeconds ?? 0}s`}
                  {selectedShot.status === 'generating' && t('gen.videoGen')}
                </div>
              </div>
            ) : selectedShot.status === 'done' && selectedShot.startImageUrl ? (
              <img className="ad-gen__preview-img" src={selectedShot.startImageUrl} draggable={false} />
            ) : selectedShot.status === 'error' ? (
              <div className="ad-gen__preview-inner">
                {selectedShot.error && <span className="ad-gen__shot-err-msg">{selectedShot.error}</span>}
                <button
                  className="ad-gen__regen-btn"
                  onClick={() => { sfxTap(); onRegen(selectedShot.id); }}
                  disabled={isGenerating}
                >
                  {t('gen.regen')}
                </button>
              </div>
            ) : (
              <div className="ad-gen__preview-inner">
                <span className="ad-gen__preview-shot-num">{String(selectedIndex + 1).padStart(2, '0')}</span>
              </div>
            )}
          </div>

          {/* Current shot prompt */}
          {selectedShot.prompt && (
            <div className="ad-gen__prompt-text">{selectedShot.prompt}</div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="ad-gen__footer">
        {/* Continue button — when there are remaining shots and nothing generating */}
        {!isGenerating && hasRemaining && (
          <button className="ad-gen__continue-btn" onPointerDown={() => { sfxConfirm(); onContinue(); }}>
            {t('gen.continue')}（{active.filter(s => s.status === 'idle' || s.status === 'error').length} {t('script.shots')}）
          </button>
        )}

        {/* Preview button — as soon as any shots are done */}
        {successShots.length > 0 && (
          <button
            className={`ad-gen__preview-btn${allPreloaded ? '' : ' ad-gen__preview-btn--loading'}`}
            onPointerDown={allPreloaded ? () => { sfxConfirm(); onPreview(); } : undefined}
            disabled={!allPreloaded}
          >
            {allPreloaded
              ? `▶ ${t('gen.preview')}（${successShots.length} ${t('script.shots')}）`
              : `${t('gen.loading')} ${loadedCount} / ${successShots.length}…`}
          </button>
        )}

        {allSettled && successShots.length === 0 && (
          <p className="ad-gen__all-fail">{t('gen.allFailed')}</p>
        )}
      </div>

      {/* Single shot video preview overlay */}
      {previewUrl && (
        <div className="ad-gen__overlay" onPointerDown={() => setPreviewUrl(null)}>
          <video
            src={previewUrl}
            autoPlay
            playsInline
            controls
            onPointerDown={e => e.stopPropagation()}
          />
          <button className="ad-gen__overlay-close" onPointerDown={() => setPreviewUrl(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
