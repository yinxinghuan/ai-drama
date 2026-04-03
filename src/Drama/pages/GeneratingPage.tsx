import type { Shot } from '../types';
import './GeneratingPage.less';

interface Props {
  shots: Shot[];
  totalCount: number;
}

export default function GeneratingPage({ shots, totalCount }: Props) {
  const doneCount = shots.filter(s => s.status === 'done').length;
  const errorCount = shots.filter(s => s.status === 'error').length;
  const progress = Math.round((doneCount / totalCount) * 100);

  return (
    <div className="ad-gen">
      <div className="ad-gen__top">
        <div className="ad-gen__icon">🎬</div>
        <h2 className="ad-gen__title">正在拍摄…</h2>
        <p className="ad-gen__sub">所有镜头同时生成，约需 2-3 分钟</p>
      </div>

      {/* Progress bar */}
      <div className="ad-gen__bar-wrap">
        <div className="ad-gen__bar">
          <div className="ad-gen__bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="ad-gen__bar-label">{doneCount} / {totalCount}</span>
      </div>

      {/* Shot list */}
      <div className="ad-gen__shots">
        {shots.map((shot, i) => (
          <div key={shot.id} className={`ad-gen__shot ad-gen__shot--${shot.status}`}>
            <div className="ad-gen__shot-num">镜头 {i + 1}</div>
            <div className="ad-gen__shot-prompt">{shot.prompt}</div>
            <div className="ad-gen__shot-status">
              {shot.status === 'idle' && <span className="ad-gen__dot ad-gen__dot--wait" />}
              {shot.status === 'imaging' && <><span className="ad-gen__spinner" /><span className="ad-gen__step-label">生图中</span></>}
              {shot.status === 'generating' && <><span className="ad-gen__spinner" /><span className="ad-gen__step-label">生成视频</span></>}
              {shot.status === 'done' && <span className="ad-gen__check">✓</span>}
              {shot.status === 'error' && <span className="ad-gen__err">✕</span>}
            </div>
          </div>
        ))}
      </div>

      {errorCount > 0 && (
        <p className="ad-gen__error-hint">{errorCount} 个镜头生成失败，放映时跳过</p>
      )}
    </div>
  );
}
