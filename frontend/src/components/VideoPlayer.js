
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiPost, apiDelete } from '../api';
import VideoJSPlayer from './VideoJSPlayer';

export default function VideoPlayer({ video, onLikeToggle, onRated, commentsUI }) {
  const { user } = useAuth();
  const [quality, setQuality] = useState(video.has_720 ? '720p' : (video.has_480 ? '480p' : 'Оригинал'));

  const rate = async (val) => {
    if (!user) { alert('Войдите, чтобы ставить оценку'); return; }
    try {
      const res = await apiPost(`/api/videos/${video.id}/rating`, { value: val });
      onRated && onRated(res);
    } catch (e) { console.error(e); }
  };
  const unrate = async () => {
    if (!user) { alert('Войдите'); return; }
    try {
      const res = await apiDelete(`/api/videos/${video.id}/rating`);
      onRated && onRated(res);
    } catch (e) { console.error(e); }
  };
  const toggleLike = async () => {
    if (!user) { alert('Войдите, чтобы лайкать'); return; }
    try {
      if (!video.liked_by_user) {
        const res = await apiPost(`/api/videos/${video.id}/like`, {});
        onLikeToggle && onLikeToggle(res);
      } else {
        const res = await apiDelete(`/api/videos/${video.id}/like`);
        onLikeToggle && onLikeToggle(res);
      }
    } catch (e) { console.error(e); }
  };
  const toggleDislike = async () => {
    if (!user) { alert('Войдите, чтобы дизлайкать'); return; }
    try {
      if (!video.disliked_by_user) {
        const res = await apiPost(`/api/videos/${video.id}/dislike`, {});
        onLikeToggle && onLikeToggle(res);
      } else {
        const res = await apiDelete(`/api/videos/${video.id}/dislike`);
        onLikeToggle && onLikeToggle(res);
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ position:'relative', maxWidth: '900px', margin: '0 auto' }}>
      <VideoJSPlayer video={video} quality={quality} onQualityChange={setQuality} />

      {/* Overlay controls */}
      <div style={{ position:'absolute', top:10, right:10, display:'flex', gap:8, alignItems:'center' }}>
        <button onClick={toggleLike} title="Нравится" style={{ padding:'4px 8px' }}>{video.liked_by_user ? '👍' : '👍'} {video.likes_count}</button>
        <button onClick={toggleDislike} title="Не нравится" style={{ padding:'4px 8px' }}>{video.disliked_by_user ? '👎' : '👎'} {video.dislikes_count || 0}</button>
        {commentsUI}
      </div>

      {/* Rating stars (1..7) */}
      <div style={{ position:'absolute', bottom:10, left:10, background:'rgba(0,0,0,.35)', borderRadius:12, padding:'6px 10px' }}>
        <span style={{ marginRight: 8 }}>Оценка:</span>
        {[1,2,3,4,5,6,7].map(n => (
          <span key={n}
            onClick={() => rate(n)}
            title={`${n}`}
            style={{
              cursor:'pointer',
              color: (video.my_rating || Math.round(video.avg_rating)) >= n ? '#ffd166' : '#bbb',
              fontSize: 20,
              marginRight: 2
            }}>★</span>
        ))}
        {video.my_rating ? <button onClick={unrate} style={{ marginLeft:8 }}>Сбросить</button> : null}
        <span style={{ marginLeft: 8, fontSize: 12 }}>ср.: {video.avg_rating?.toFixed(1)}</span>
      </div>

    </div>
  );
}
