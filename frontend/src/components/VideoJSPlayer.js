
import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

/**
 * props: video {id, has_720, has_480}, defaultQuality
 */
export default function VideoJSPlayer({ video, quality, onQualityChange }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [mini, setMini] = React.useState(false);

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
        playerRef.current.src({ src, type: 'video/mp4' });
        if (wasPlaying) playerRef.current.play();
        onQualityChange && onQualityChange(lbl);
      }
    };
    wrapper.appendChild(select);
    const fullscreenToggle = controlBar.getChild('fullscreenToggle');
    controlBar.el().insertBefore(wrapper, fullscreenToggle ? fullscreenToggle.el() : null);

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
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
    playerRef.current.src({ src, type: 'video/mp4' });
    if (wasPlaying) playerRef.current.play();
  }, [quality, video.id, video.has_720, video.has_480]);

  return (
    <div ref={containerRef} style={{ position:'relative' }}>
      <div data-vjs-player style={ mini ? { position:'fixed', right:16, bottom:16, width:320, zIndex:40, boxShadow:'0 10px 28px rgba(0,0,0,.45)', borderRadius:8, overflow:'hidden', cursor:'pointer' } : {} }
        onClick={() => { if (mini) window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
        <video ref={videoRef} className="video-js vjs-default-skin" playsInline />
      </div>
    </div>
  );
}
