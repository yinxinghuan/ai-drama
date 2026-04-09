import { useState, useRef, useEffect, useCallback } from 'react';
import type { Shot, Character } from '../types';
import './TheaterPage.less';

interface Props {
  shots: Shot[];
  defaultCharacter: Character | null;
  onBack: () => void;
  onRestart: () => void;
  onRegenShot: (shotId: string) => void;
}

function resolveChar(shot: Shot, shots: Shot[], defaultChar: Character | null): Character | null {
  return shot.character ?? shots[0]?.character ?? defaultChar;
}

export default function TheaterPage({ shots, defaultCharacter, onBack, onRestart, onRegenShot }: Props) {
  const playable = shots.filter(s => s.status === 'done' && s.videoUrl);
  const [current, setCurrent] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [shotIndicator, setShotIndicator] = useState<number | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStart = useRef<{ x: number; y: number; t: number } | null>(null);

  const shot = playable[current];

  // ── Preload all videos on mount ──────────────────────────────────────────
  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, playable.length);
  }, [playable.length]);

  // Play current, pause others
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === current) {
        v.currentTime = 0;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [current]);

  // ── Shot indicator ───────────────────────────────────────────────────────
  const showShotIndicator = useCallback((idx: number) => {
    setShotIndicator(idx);
    if (indicatorTimer.current) clearTimeout(indicatorTimer.current);
    indicatorTimer.current = setTimeout(() => setShotIndicator(null), 1500);
  }, []);

  // Show indicator on first render
  useEffect(() => {
    showShotIndicator(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Navigation ───────────────────────────────────────────────────────────
  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= playable.length || idx === current) return;
    setCurrent(idx);
    showShotIndicator(idx);
  }, [playable.length, current, showShotIndicator]);

  // ── Controls auto-hide ───────────────────────────────────────────────────
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowControls(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // ── Swipe gesture ────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    swipeStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const start = swipeStart.current;
    if (!start) return;
    swipeStart.current = null;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dt = Date.now() - start.t;

    // Must be horizontal-ish swipe: |dx| > 50px, |dx| > |dy|, within 500ms
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && dt < 500) {
      if (dx < 0) goTo(current + 1);  // swipe left → next
      else goTo(current - 1);          // swipe right → prev
    } else {
      // Tap — toggle controls
      showControlsTemporarily();
    }
  }, [current, goTo, showControlsTemporarily]);

  // ── Empty state ──────────────────────────────────────────────────────────
  if (playable.length === 0) {
    const errors = shots.filter(s => s.status === 'error');
    return (
      <div className="ad-theater ad-theater--empty">
        <p>所有镜头都生成失败了</p>
        {errors.map((s, i) => (
          <p key={s.id} style={{ fontSize: 11, color: '#f87171', margin: '4px 16px', wordBreak: 'break-all' }}>
            镜头{i + 1}: {s.error}
          </p>
        ))}
        <button className="ad-theater__restart" onPointerDown={onRestart}>重新开始</button>
      </div>
    );
  }

  const failedShots = shots.filter(s => s.status === 'error');

  return (
    <div
      className="ad-theater"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* All videos stacked — preloaded, only current is visible */}
      {playable.map((s, i) => (
        <video
          key={s.videoUrl}
          ref={el => { videoRefs.current[i] = el; }}
          className={`ad-theater__video${i === current ? ' ad-theater__video--active' : ''}`}
          src={s.videoUrl}
          preload="auto"
          playsInline
          onEnded={() => goTo(i + 1)}
        />
      ))}

      {/* Shot number indicator */}
      {shotIndicator !== null && (
        <div className="ad-theater__indicator" key={shotIndicator}>
          <span className="ad-theater__indicator-num">{shotIndicator + 1}</span>
          <span className="ad-theater__indicator-total">/ {playable.length}</span>
        </div>
      )}

      {/* Overlay controls */}
      <div className={`ad-theater__overlay${showControls ? ' ad-theater__overlay--show' : ''}`}>
        {/* Top */}
        <div className="ad-theater__top">
          <button className="ad-theater__back" onPointerDown={(e) => { e.stopPropagation(); onBack(); }}>←</button>
          {(() => {
            const ch = shot ? resolveChar(shot, shots, defaultCharacter) : null;
            return ch ? (
              <div className="ad-theater__char">
                <div className="ad-theater__avatar">
                  {ch.head_url
                    ? <img src={ch.head_url} alt={ch.name} draggable={false} />
                    : <span>{ch.name.slice(0, 2)}</span>}
                </div>
                <span>{ch.name}</span>
              </div>
            ) : null;
          })()}
          <span className="ad-theater__counter">{current + 1} / {playable.length}</span>
        </div>

        {/* Bottom */}
        <div className="ad-theater__bottom">
          <p className="ad-theater__prompt">{shot?.prompt}</p>
          {/* Dots */}
          <div className="ad-theater__dots">
            {playable.map((_, i) => (
              <span
                key={i}
                className={`ad-theater__dot${i === current ? ' ad-theater__dot--active' : ''}`}
                onPointerDown={(e) => { e.stopPropagation(); goTo(i); }}
              />
            ))}
          </div>
          <div className="ad-theater__actions">
            <button className="ad-theater__regen ad-theater__regen--current" onPointerDown={(e) => { e.stopPropagation(); onRegenShot(shot.id); }}>
              重拍此镜头
            </button>
            {failedShots.map(s => (
              <button key={s.id} className="ad-theater__regen" onPointerDown={(e) => { e.stopPropagation(); onRegenShot(s.id); }}>
                重拍镜头 {shots.indexOf(s) + 1}（失败）
              </button>
            ))}
            <button className="ad-theater__restart" onPointerDown={(e) => { e.stopPropagation(); onRestart(); }}>重新导演</button>
          </div>
        </div>
      </div>
    </div>
  );
}
