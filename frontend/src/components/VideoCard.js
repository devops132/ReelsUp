
import React from 'react';
import { Link } from 'react-router-dom';

export default function VideoCard({ video }) {
  return (
    <div className="video-card">
      <video src={`/api/videos/${video.id}/content`} controls preload="metadata" />
      <div className="content">
        <h3><Link to={`/video/${video.id}`}>{video.title}</Link></h3>
        <small>Автор: {video.user_name} {video.category_name && (` | Категория: ${video.category_name}`)}</small><br/>
        <small>Лайков: {video.likes_count} | Комментариев: {video.comments_count}{!video.is_approved && <span style={{color:'orange'}}> (на модерации)</span>}</small>
      </div>
    </div>
  );
}
