import { useState, useEffect } from 'react';
import type { Shot } from '../types';
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

  useEffect(() => {
    if (!allSettled || successShots.length === 0) return;
    setLoadedCount(0);
    let count = 0;
    successShots.forEach(s => {
      const v = document.createElement('video');
      v.preload = 'auto';
      v.oncanplaythrough = () => { count++; setLoadedCount(count); };
      v.onerror = () => { count++; setLoadedCount(count); };
      v.src = s.videoUrl!;
    });
  }, [allSettled]);

  const progress = active.length > 0 ? Math.round((doneCount / active.length) * 100) : 0;

  return (
    <div className="ad-gen">
      <div className="ad-gen__header">
        <button className="ad-gen__back" onPointerDown={onBack}>&larr; 返回</button>
      </div>

      <div className="ad-gen__top">
        <div className="ad-gen__icon">🎬</div>
        <h2 className="ad-gen__title">{allSettled ? '拍摄完成！' : isGenerating ? '正在拍摄…' : '镜头总览'}</h2>
        {isGenerating && (
          <>
            <p className="ad-gen__sub">每个镜头约需 2-3 分钟</p>
            <p className="ad-gen__tip">可以先回主页做别的，完成后在作品列表查看<br />⚠️ 关闭小程序会中断生成</p>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="ad-gen__bar-wrap">
        <div className="ad-gen__bar">
          <div className="ad-gen__bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="ad-gen__bar-label">{successShots.length} / {active.length}</span>
      </div>

      {/* Shot list */}
      <div className="ad-gen__shots">
        {active.map((shot, i) => (
          <div key={shot.id} className={`ad-gen__shot ad-gen__shot--${shot.status}`}>
            {/* Thumbnail for completed shots */}
            {shot.status === 'done' && shot.videoUrl ? (
              <div className="ad-gen__shot-thumb" onPointerDown={() => setPreviewUrl(shot.videoUrl!)}>
                {shot.startImageUrl
                  ? <img src={shot.startImageUrl} draggable={false} />
                  : <div className="ad-gen__shot-thumb-empty">▶</div>
                }
                <span className="ad-gen__shot-thumb-play">▶</span>
              </div>
            ) : null}

            <div className="ad-gen__shot-body">
              <div className="ad-gen__shot-num">镜头 {i + 1}</div>
              <div className="ad-gen__shot-prompt">{shot.prompt}</div>
            </div>

            <div className="ad-gen__shot-status">
              {shot.status === 'idle'      && <span className="ad-gen__dot ad-gen__dot--wait" />}
              {shot.status === 'imaging'   && <><span className="ad-gen__spinner" /><span className="ad-gen__step-label">生图中</span></>}
              {shot.status === 'waiting'   && <><span className="ad-gen__cooldown">{shot.waitSeconds ?? 0}s</span><span className="ad-gen__step-label">冷却中</span></>}
              {shot.status === 'generating'&& <><span className="ad-gen__spinner" /><span className="ad-gen__step-label">生成视频</span></>}
              {shot.status === 'done'      && <span className="ad-gen__check">✓</span>}
              {shot.status === 'error'     && (
                <button
                  className="ad-gen__regen-btn"
                  onPointerDown={() => onRegen(shot.id)}
                  disabled={isGenerating}
                >
                  重拍
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="ad-gen__footer">
        {/* Continue button — when there are remaining shots and nothing generating */}
        {!isGenerating && hasRemaining && (
          <button className="ad-gen__continue-btn" onPointerDown={onContinue}>
            继续生成（{active.filter(s => s.status === 'idle' || s.status === 'error').length} 个镜头）
          </button>
        )}

        {/* Preview button — as soon as any shots are done */}
        {successShots.length > 0 && (
          <button
            className={`ad-gen__preview-btn${allPreloaded ? '' : ' ad-gen__preview-btn--loading'}`}
            onPointerDown={allPreloaded ? onPreview : undefined}
            disabled={!allPreloaded}
          >
            {allPreloaded
              ? `▶ 预览（${successShots.length} 个镜头）`
              : `加载中 ${loadedCount} / ${successShots.length}…`}
          </button>
        )}

        {allSettled && successShots.length === 0 && (
          <p className="ad-gen__all-fail">所有镜头均失败，请重拍</p>
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
