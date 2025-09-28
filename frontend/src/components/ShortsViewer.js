import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiDelete, apiPost } from '../api';
import VideoJSPlayer from './VideoJSPlayer';
import { IconLike, IconDislike, IconShare } from './Icons';

export default function ShortsViewer({ videos, startIndex = 0, onExit }) {
  const { user } = useAuth();
  const [index, setIndex] = useState(() => Math.min(Math.max(0, startIndex), Math.max(0, (videos?.length || 1) - 1)));
  const [quality, setQuality] = useState('Оригинал');
  const [playing, setPlaying] = useState(true);
  const wrapRef = useRef(null);
  const touchStartY = useRef(0);
  const touchDeltaY = useRef(0);
  const swipeLock = useRef(false);

  const current = videos && videos[index];

  const next = useCallback(() => {
    if (!videos || index >= videos.length - 1) return;
    setIndex(index + 1);
  }, [index, videos]);

  const prev = useCallback(() => {
    if (!videos || index <= 0) return;
    setIndex(index - 1);
  }, [index, videos]);

  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    touchStartY.current = e.touches[0].clientY;
    touchDeltaY.current = 0;
    swipeLock.current = false;
  };
  const handleTouchMove = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    touchDeltaY.current = e.touches[0].clientY - touchStartY.current;
  };
  const handleTouchEnd = () => {
    const dy = touchDeltaY.current;
    const threshold = 60; // pixels
    if (swipeLock.current) return;
    if (dy <= -threshold) { swipeLock.current = true; next(); }
    else if (dy >= threshold) { swipeLock.current = true; prev(); }
  };

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    node.addEventListener('touchstart', handleTouchStart, { passive: true });
    node.addEventListener('touchmove', handleTouchMove, { passive: true });
    node.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      node.removeEventListener('touchstart', handleTouchStart);
      node.removeEventListener('touchmove', handleTouchMove);
      node.removeEventListener('touchend', handleTouchEnd);
    };
  }, [wrapRef.current, next, prev]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowUp') prev();
      if (e.key === 'ArrowDown') next();
      if (e.key === 'Escape' && onExit) onExit();
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        const el = wrapRef.current?.querySelector('video');
        if (el) {
          if (el.paused) { el.play(); setPlaying(true); } else { el.pause(); setPlaying(false); }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onExit]);

  if (!current) return null;

  const toggleLike = async () => {
    if (!user) { alert('Войдите, чтобы лайкать'); return; }
    try {
      if (!current.liked_by_user) {
        await apiPost(`/api/videos/${current.id}/like`, {});
        current.liked_by_user = true; current.likes_count = (current.likes_count || 0) + 1;
      } else {
        await apiDelete(`/api/videos/${current.id}/like`);
        current.liked_by_user = false; current.likes_count = Math.max(0, (current.likes_count || 0) - 1);
      }
    } catch {}
  };
  const toggleDislike = async () => {
    if (!user) { alert('Войдите, чтобы дизлайкать'); return; }
    try {
      if (!current.disliked_by_user) {
        await apiPost(`/api/videos/${current.id}/dislike`, {});
        current.disliked_by_user = true; current.dislikes_count = (current.dislikes_count || 0) + 1;
      } else {
        await apiDelete(`/api/videos/${current.id}/dislike`);
        current.disliked_by_user = false; current.dislikes_count = Math.max(0, (current.dislikes_count || 0) - 1);
      }
    } catch {}
  };

  return (
    <div ref={wrapRef} className="shorts-fullscreen">
      <div className="shorts-video-wrap">
        <VideoJSPlayer
          video={current}
          quality={quality}
          onQualityChange={setQuality}
          onTimeUpdate={() => {}}
          initialScaleMode="cover"
          onFullscreenChange={() => {}}
          onEnded={next}
        />
      </div>

      <div className="shorts-topbar">
        <button className="ghost-button" onClick={onExit}>Назад</button>
        <div style={{ opacity:.9 }}>{index+1} / {videos.length}</div>
      </div>

      <div className="shorts-overlay-right">
        <button title="Нравится" onClick={toggleLike} className="shorts-ctrl">
          <IconLike color="#fff" />
          <span>{current.likes_count || 0}</span>
        </button>
        <button title="Не нравится" onClick={toggleDislike} className="shorts-ctrl">
          <IconDislike color="#fff" />
          <span>{current.dislikes_count || 0}</span>
        </button>
        <button title="Поделиться" onClick={async()=>{
          try {
            const url = window.location.origin + '/video/' + current.id;
            if (navigator.share) await navigator.share({ title: current.title, url });
            else { await navigator.clipboard.writeText(url); alert('Ссылка скопирована'); }
          } catch {}
        }} className="shorts-ctrl">
          <IconShare color="#fff" />
        </button>
      </div>

      <div className="shorts-bottom">
        <h3 className="shorts-title" title={current.title}>{current.title}</h3>
        {current.author_name && <div className="shorts-author">{current.author_name}</div>}
      </div>
    </div>
  );
}


