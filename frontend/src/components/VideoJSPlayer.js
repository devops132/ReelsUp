
import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

/**
 * props: video {id, has_720, has_480}, defaultQuality
 */
export default function VideoJSPlayer({ video, quality, onQualityChange }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

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
    <div data-vjs-player>
      <video ref={videoRef} className="video-js vjs-default-skin" playsInline />
    </div>
  );
}
