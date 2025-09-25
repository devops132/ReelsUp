
import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

/**
 * props: video {id, has_720, has_480}, defaultQuality
 */
export default function VideoJSPlayer({
  video,
  quality,
  onQualityChange,
  overlayDurationMs = 1200,
  resumeTime = 0,
  onTimeUpdate,
  onFullscreenChange
}) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [mini, setMini] = React.useState(false);
  const statusTimeoutRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rememberScalePrefKey = 'reelsup_scale_remember';
  const rememberScaleValueKey = 'reelsup_scale_mode';
  const [rememberScale, setRememberScale] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(rememberScalePrefKey) === '1';
  });
  const [scaleMode, setScaleMode] = useState(() => {
    if (typeof window === 'undefined') return 'contain';
    return window.localStorage.getItem(rememberScaleValueKey) || 'contain';
  });
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 820;
  });
  const resumeAppliedRef = useRef(null);
  const timeUpdateHandlerRef = useRef(null);
  const fullscreenHandlerRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const sources = [];
    if (video.has_720) sources.push({ src: `/api/videos/${video.id}/content?quality=720p`, label: '720p' });
    if (video.has_480) sources.push({ src: `/api/videos/${video.id}/content?quality=480p`, label: '480p' });
    sources.push({ src: `/api/videos/${video.id}/content?quality=original`, label: 'Оригинал' });

    playerRef.current = videojs(el, {
      playbackRates: [0.75, 1, 1.25, 1.5],
      controls: true,
      fluid: true,
      sources: [{ src: sources.find(s => s.label===quality)?.src || sources[sources.length-1].src, type: 'video/mp4' }]
    });

    if (onTimeUpdate) {
      const handler = () => {
        if (!playerRef.current) return;
        const current = playerRef.current.currentTime() || 0;
        onTimeUpdate(current);
      };
      timeUpdateHandlerRef.current = handler;
      playerRef.current.on('timeupdate', handler);
    }

    const onFullscreen = () => {
      if (!playerRef.current) return;
      const fs = playerRef.current.isFullscreen();
      setIsFullscreen(fs);
      onFullscreenChange && onFullscreenChange(fs);
    };
    fullscreenHandlerRef.current = onFullscreen;
    playerRef.current.on('fullscreenchange', onFullscreen);

    // simple quality dropdown inserted into the control bar
    const controlBar = playerRef.current.getChild('controlBar');
    const wrapper = document.createElement('div');
    wrapper.className = 'vjs-quality-menu vjs-control';
    const select = document.createElement('select');
    select.className = 'vjs-quality-select';
    select.title = 'Качество';
    sources.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.label;
      opt.textContent = s.label;
      if (s.label === quality) opt.selected = true;
      select.appendChild(opt);
    });
    select.onchange = () => {
      const lbl = select.value;
      const src = sources.find(x => x.label === lbl)?.src;
      if (src) {
        const wasPlaying = !playerRef.current.paused();
        const current = playerRef.current.currentTime();
        playerRef.current.src({ src, type: 'video/mp4' });
        playerRef.current.one('loadedmetadata', () => {
          if (!playerRef.current) return;
          if (!Number.isNaN(current)) playerRef.current.currentTime(current);
          if (wasPlaying) playerRef.current.play();
        });
        onQualityChange && onQualityChange(lbl);
      }
    };
    wrapper.appendChild(select);
    const fullscreenToggle = controlBar.getChild('fullscreenToggle');
    controlBar.el().insertBefore(wrapper, fullscreenToggle ? fullscreenToggle.el() : null);

    // Center play/pause overlay for mobile fullscreen
    const overlay = document.createElement('div');
    overlay.className = 'vjs-center-toggle';
    const status = document.createElement('div');
    status.className = 'vjs-center-status';
    overlay.appendChild(status);
    const playSvg = '\n<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n  <path d="M8 5v14l11-7-11-7Z" fill="#fff"/>\n</svg>';
    const pauseSvg = '\n<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n  <rect x="6" y="5" width="4" height="14" fill="#fff"/>\n  <rect x="14" y="5" width="4" height="14" fill="#fff"/>\n</svg>';
    const onOverlayClick = () => {
      if (!playerRef.current) return;
      const wasPaused = playerRef.current.paused();
      if (wasPaused) playerRef.current.play(); else playerRef.current.pause();
      status.innerHTML = wasPaused ? playSvg : pauseSvg;
      status.classList.add('show');
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = setTimeout(() => { status.classList.remove('show'); }, overlayDurationMs);
    };
    overlay.addEventListener('click', onOverlayClick);
    playerRef.current.el().appendChild(overlay);

    return () => {
      if (playerRef.current) {
        if (timeUpdateHandlerRef.current) {
          playerRef.current.off('timeupdate', timeUpdateHandlerRef.current);
          timeUpdateHandlerRef.current = null;
        }
        if (fullscreenHandlerRef.current) {
          playerRef.current.off('fullscreenchange', fullscreenHandlerRef.current);
          fullscreenHandlerRef.current = null;
        }
      }
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
      if (statusTimeoutRef.current) { clearTimeout(statusTimeoutRef.current); statusTimeoutRef.current = null; }
    };
    }, [video.id, onTimeUpdate, onFullscreenChange]);

  useEffect(() => {
    const updateMobileState = () => {
      if (typeof window === 'undefined') return;
      setIsMobile(window.innerWidth <= 820);
    };
    updateMobileState();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateMobileState);
      return () => window.removeEventListener('resize', updateMobileState);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (!playerRef.current) return;
    const el = playerRef.current.el();
    if (!el) return;
    el.classList.remove('vjs-scale-contain', 'vjs-scale-cover');
    el.classList.add(scaleMode === 'cover' ? 'vjs-scale-cover' : 'vjs-scale-contain');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(rememberScalePrefKey, rememberScale ? '1' : '0');
      if (rememberScale) {
        window.localStorage.setItem(rememberScaleValueKey, scaleMode);
      } else {
        window.localStorage.removeItem(rememberScaleValueKey);
      }
    }
  }, [scaleMode, rememberScale]);

  useEffect(() => {
    if (!playerRef.current) return;
    if (resumeTime == null) return;
    if (resumeAppliedRef.current === resumeTime) return;
    const applyTime = () => {
      if (!playerRef.current) return;
      const target = Math.max(0, resumeTime || 0);
      try {
        playerRef.current.currentTime(target);
        resumeAppliedRef.current = resumeTime;
      } catch {}
    };
    if (playerRef.current.readyState() >= 1) {
      applyTime();
    } else {
      playerRef.current.one('loadedmetadata', applyTime);
    }
  }, [resumeTime]);

  useEffect(() => {
    resumeAppliedRef.current = null;
  }, [video.id]);

  // Mini-player: stick to bottom-right when out of viewport
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setMini(!entry.isIntersecting);
    }, { threshold: 0.1 });
    const node = containerRef.current;
    if (node) observer.observe(node);
    return () => { if (node) observer.unobserve(node); };
  }, []);

  useEffect(() => {
    // when parent quality changes, update src
    if (!playerRef.current) return;
    const lbl = quality;
    const src = (video.has_720 && lbl==='720p') ? `/api/videos/${video.id}/content?quality=720p`
              : (video.has_480 && lbl==='480p') ? `/api/videos/${video.id}/content?quality=480p`
              : `/api/videos/${video.id}/content?quality=original`;
    const wasPlaying = !playerRef.current.paused();
    const current = playerRef.current.currentTime();
    playerRef.current.src({ src, type: 'video/mp4' });
    playerRef.current.one('loadedmetadata', () => {
      if (!playerRef.current) return;
      if (!Number.isNaN(current)) playerRef.current.currentTime(current);
      if (wasPlaying) playerRef.current.play();
    });
  }, [quality, video.id, video.has_720, video.has_480]);

  const showScaleControls = isMobile && isFullscreen;

  return (
    <div ref={containerRef} style={{ position:'relative' }}>
      <div data-vjs-player className={ mini ? 'mini-player' : '' } style={ mini ? { position:'fixed', zIndex:40, boxShadow:'0 10px 28px rgba(0,0,0,.45)', borderRadius:8, overflow:'hidden', cursor:'pointer' } : {} }
        onClick={() => { if (mini) window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
        <video ref={videoRef} className="video-js vjs-default-skin" playsInline />
      </div>
      {showScaleControls && (
        <div className="vjs-scale-overlay">
          <div className="vjs-scale-buttons">
            <button
              className={scaleMode === 'contain' ? 'active' : ''}
              onClick={() => setScaleMode('contain')}
            >
              Вписать
            </button>
            <button
              className={scaleMode === 'cover' ? 'active' : ''}
              onClick={() => setScaleMode('cover')}
            >
              Заполнить
            </button>
          </div>
          <label className="vjs-scale-remember">
            <input
              type="checkbox"
              checked={rememberScale}
              onChange={(e) => setRememberScale(e.target.checked)}
            />
            Запомнить выбор
          </label>
        </div>
      )}
    </div>
  );
}
