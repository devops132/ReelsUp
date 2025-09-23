
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
          {video.category_name && (
            <Link to={`/?categories=${video.category_id}`} className="badge" data-tooltip="Добавить категорию в фильтр" style={{ marginLeft: 6 }}>
              {video.parent_category_name ? `${video.parent_category_name} › ${video.category_name}` : video.category_name}
            </Link>
          )}
        </small><br/>
        {video.tags && (
          <div style={{ marginTop:6, display:'flex', flexWrap:'wrap', gap:6 }}>
            {video.tags.split(/[,\s]+/).filter(Boolean).slice(0,6).map((t,i) => (
              <Link key={i} to={`/?tags=${encodeURIComponent(t)}`} className="badge" data-tooltip={`Добавить тег в фильтр`}>{t.startsWith('#') ? t : ('#'+t)}</Link>
            ))}
          </div>
        )}
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
