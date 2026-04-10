import { useState, useRef, useEffect, useCallback } from 'react';
import { t } from '../i18n';
import type { Shot, Character } from '../types';
import { sfxTap, sfxNav } from '../utils/sounds';
import './TheaterPage.less';

interface Props {
  shots: Shot[];
  defaultCharacter: Character | null;
  onBack: () => void;
  onRestart: () => void;
  onRegenShot: (shotId: string) => void;
  shareMode?: boolean;
}

function resolveChar(shot: Shot, shots: Shot[], defaultChar: Character | null): Character | null {
  return shot.character ?? shots[0]?.character ?? defaultChar;
}

export default function TheaterPage({ shots, defaultCharacter, onBack, onRestart, onRegenShot, shareMode }: Props) {
  const playable = shots.filter(s => s.status === 'done' && s.videoUrl);
  const [current, setCurrent] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [shotIndicator, setShotIndicator] = useState<number | null>(null);
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStart = useRef<{ x: number; y: number; t: number } | null>(null);

  const shot = playable[current];

  // ── Preload all videos on mount ──────────────────────────────────────────
  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, playable.length);
  }, [playable.length]);

  // Play current, pause others
  useEffect(() => {
    // Small delay to ensure refs are bound after render
    const timer = setTimeout(() => {
      videoRefs.current.forEach((v, i) => {
        if (!v) return;
        if (i === current) {
          v.currentTime = 0;
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [current, playable.length]);

  // ── Show controls + indicator together ─────────────────────────────────
  const showAll = useCallback((idx?: number) => {
    if (idx !== undefined) setShotIndicator(idx);
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      setShowControls(false);
      setShotIndicator(null);
    }, 4000);
  }, []);

  // Delay first indicator until video is actually playing
  const firstShown = useRef(false);
  useEffect(() => {
    const v = videoRefs.current[0];
    if (!v || firstShown.current) return;
    const onPlay = () => { firstShown.current = true; showAll(0); };
    // If already playing (autoplay succeeded)
    if (!v.paused && v.currentTime > 0) { onPlay(); return; }
    v.addEventListener('playing', onPlay, { once: true });
    return () => v.removeEventListener('playing', onPlay);
  });

  // ── Navigation ───────────────────────────────────────────────────────────
  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= playable.length || idx === current) return;
    setCurrent(idx);
    showAll(idx);
  }, [playable.length, current, showAll]);

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
      showAll();
    }
  }, [current, goTo, showAll]);

  // ── Share ────────────────────────────────────────────────────────────────
  const handleShare = useCallback(() => {
    if (!shot?.videoUrl) return;
    if (navigator.share) {
      navigator.share({ url: shot.videoUrl }).catch(() => {});
    }
  }, [shot]);

  // ── Empty state ──────────────────────────────────────────────────────────
  if (playable.length === 0) {
    const errors = shots.filter(s => s.status === 'error');
    return (
      <div className="ad-theater ad-theater--empty">
        <p>{t('theater.allFailed')}</p>
        {errors.map((s, i) => (
          <p key={s.id} style={{ fontSize: 11, color: '#b07868', margin: '4px 16px', wordBreak: 'break-all' }}>
            {t('script.shot')} {i + 1}: {s.error}
          </p>
        ))}
        <button className="ad-theater__restart" onPointerDown={() => { sfxNav(); onRestart(); }}>{t('theater.restart')}</button>
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
          className={`ad-theater__video${i === current ? ' ad-theater__video--active' : ''}${fitMode === 'contain' ? ' ad-theater__video--contain' : ''}`}
          src={s.videoUrl}
          preload="auto"
          playsInline
          onEnded={() => goTo(i + 1 < playable.length ? i + 1 : 0)}
        />
      ))}

      {/* Overlay controls + indicator shown together */}
      <div className={`ad-theater__overlay${showControls ? ' ad-theater__overlay--show' : ''}`}>
        {/* Top */}
        <div className="ad-theater__top">
          {!shareMode && <button className="ad-theater__back" onPointerDown={(e) => { e.stopPropagation(); sfxNav(); onBack(); }}>←</button>}
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
          <div className="ad-theater__top-right">
            <button
              className="ad-theater__fit-toggle"
              onPointerDown={(e) => {
                e.stopPropagation();
                sfxNav();
                setFitMode(prev => prev === 'cover' ? 'contain' : 'cover');
              }}
            >
              {fitMode === 'cover' ? '1:1' : '▣'}
            </button>
            <span className="ad-theater__counter">{String(current + 1).padStart(2, '0')} / {String(playable.length).padStart(2, '0')}</span>
          </div>
        </div>

        {/* Spacer pushes bottom down */}
        <div style={{ flex: 1 }} />

        {/* Bottom */}
        <div className="ad-theater__bottom">
          {/* Shot indicator — above prompt */}
          {shotIndicator !== null && (
            <div className="ad-theater__indicator" key={shotIndicator}>
              <span className="ad-theater__indicator-label">SCENE</span>
              <div className="ad-theater__indicator-row">
                <span className="ad-theater__indicator-num">{String(shotIndicator + 1).padStart(2, '0')}</span>
                <span className="ad-theater__indicator-sep">/</span>
                <span className="ad-theater__indicator-total">{String(playable.length).padStart(2, '0')}</span>
              </div>
              <div className="ad-theater__indicator-line" />
            </div>
          )}
          <p className="ad-theater__prompt">{shot?.prompt}</p>
          {/* Segment bars */}
          <div className="ad-theater__dots">
            {playable.map((_, i) => (
              <span
                key={i}
                className={`ad-theater__dot${i === current ? ' ad-theater__dot--active' : i < current ? ' ad-theater__dot--played' : ''}`}
                onPointerDown={(e) => { e.stopPropagation(); goTo(i); }}
              />
            ))}
          </div>
          {!shareMode && (
            <div className="ad-theater__actions">
              <button className="ad-theater__regen ad-theater__regen--current" onPointerDown={(e) => { e.stopPropagation(); sfxTap(); onRegenShot(shot.id); }}>
                {t('theater.regenCurrent')}
              </button>
              {failedShots.map(s => (
                <button key={s.id} className="ad-theater__regen" onPointerDown={(e) => { e.stopPropagation(); sfxTap(); onRegenShot(s.id); }}>
                  {t('theater.regenFailed')} {shots.indexOf(s) + 1}（{t('theater.failed')}）
                </button>
              ))}
              <button className="ad-theater__share" onPointerDown={(e) => { e.stopPropagation(); sfxTap(); handleShare(); }}>
                {t('theater.share')}
              </button>
              <button className="ad-theater__restart" onPointerDown={(e) => { e.stopPropagation(); sfxNav(); onRestart(); }}>{t('theater.reDirector')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
