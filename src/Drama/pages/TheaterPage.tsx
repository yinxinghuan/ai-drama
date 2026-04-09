import { useState, useRef, useEffect } from 'react';
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
  const [fading, setFading] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shot = playable[current];

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= playable.length) return;
    setFading(true);
    setVideoReady(false);
    setTimeout(() => {
      setCurrent(idx);
      setFading(false);
    }, 300);
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowControls(false), 3000);
    return () => clearTimeout(timer);
  }, []);

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
    <div className="ad-theater" onPointerDown={showControlsTemporarily}>
      {/* Loading overlay for current video */}
      {!videoReady && (
        <div className="ad-theater__loading">
          <div className="ad-theater__loading-spinner" />
        </div>
      )}

      {/* Video */}
      <video
        ref={videoRef}
        key={shot?.videoUrl}
        className={`ad-theater__video${fading ? ' ad-theater__video--fade' : ''}`}
        src={shot?.videoUrl}
        autoPlay
        playsInline
        onCanPlay={() => setVideoReady(true)}
        onEnded={() => goTo(current + 1)}
      />

      {/* Overlay controls */}
      <div className={`ad-theater__overlay${showControls ? ' ad-theater__overlay--show' : ''}`}>
        {/* Top */}
        <div className="ad-theater__top">
          <button className="ad-theater__back" onPointerDown={onBack}>←</button>
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

        {/* Center prev/next */}
        <div className="ad-theater__nav">
          {current > 0 && (
            <button className="ad-theater__nav-btn" onPointerDown={() => goTo(current - 1)}>‹</button>
          )}
          <div style={{ flex: 1 }} />
          {current < playable.length - 1 && (
            <button className="ad-theater__nav-btn" onPointerDown={() => goTo(current + 1)}>›</button>
          )}
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
                onPointerDown={() => goTo(i)}
              />
            ))}
          </div>
          <div className="ad-theater__actions">
            <button className="ad-theater__regen ad-theater__regen--current" onPointerDown={() => onRegenShot(shot.id)}>
              重拍此镜头
            </button>
            {failedShots.map(s => (
              <button key={s.id} className="ad-theater__regen" onPointerDown={() => onRegenShot(s.id)}>
                重拍镜头 {shots.indexOf(s) + 1}（失败）
              </button>
            ))}
            <button className="ad-theater__restart" onPointerDown={onRestart}>重新导演</button>
          </div>
        </div>
      </div>
    </div>
  );
}
