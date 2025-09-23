
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconLike, IconDislike, IconEye, IconComment } from './Icons';

export default function VideoCard({ video }) {
  const staticThumb = `/api/videos/${video.id}/thumbnail`;
  const animatedThumb = `/api/videos/${video.id}/thumbnail/animated`;
  const [src, setSrc] = useState(staticThumb);

  return (
    <div className="video-card">
      <Link to={`/video/${video.id}`} className="thumb-wrap">
        <img
          src={src}
          alt={video.title}
          onMouseEnter={() => setSrc(animatedThumb)}
          onMouseLeave={() => setSrc(staticThumb)}
        />
      </Link>
      <div className="content">
        <h3><Link to={`/video/${video.id}`}>{video.title}</Link></h3>
        <small>
          Автор: {video.user_name}
          {video.category_name && <span className="badge">{video.category_name}</span>}
        </small><br/>
        <small style={{ display:'flex', gap:10, alignItems:'center', color:'var(--text-muted)' }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4 }} data-tooltip="Лайки"><IconLike /> {video.likes_count}</span>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4 }} data-tooltip="Дизлайки"><IconDislike /> {video.dislikes_count || 0}</span>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4 }} data-tooltip="Просмотры"><IconEye /> {video.views_count || 0}</span>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4 }} data-tooltip="Комментарии"><IconComment /> {video.comments_count}</span>
          {!video.is_approved && <span className="badge" style={{background:'orange'}}>Модерация</span>}
        </small>
      </div>
    </div>
  );
}
