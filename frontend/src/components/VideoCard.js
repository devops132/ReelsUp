
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

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
        <small>
          Лайков: {video.likes_count} | Комментариев: {video.comments_count}
          {!video.is_approved && <span className="badge" style={{background:'orange'}}>Модерация</span>}
        </small>
      </div>
    </div>
  );
}
