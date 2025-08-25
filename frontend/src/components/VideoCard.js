
import React from 'react';
import { Link } from 'react-router-dom';

export default function VideoCard({ video }) {
  return (
    <div className="video-card bg-[var(--card-bg)] text-[var(--text-color)]">
      <Link to={`/video/${video.id}`} className="thumb-wrap relative block overflow-hidden">
        <img
          src={`/api/videos/${video.id}/thumbnail`}
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        />
        {video.category_name && (
          <span className="absolute top-2 left-2 bg-[var(--accent-color)] text-white text-xs px-2 py-1 rounded-md">
            {video.category_name}
          </span>
        )}
        {!video.is_approved && (
          <span className="absolute bottom-2 left-2 bg-yellow-400 text-xs px-2 py-1 rounded-md">На модерации</span>
        )}
      </Link>
      <div className="content">
        <h3 className="font-semibold mb-1">
          <Link to={`/video/${video.id}`}>{video.title}</Link>
        </h3>
        <small className="block mb-1">Автор: {video.user_name}</small>
        <small>
          Лайков: {video.likes_count} | Комментариев: {video.comments_count}
        </small>
      </div>
    </div>
  );
}
