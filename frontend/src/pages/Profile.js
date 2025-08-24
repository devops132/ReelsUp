
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../api';
import VideoCard from '../components/VideoCard';

export default function Profile() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    if (!user) { nav('/login'); return; }
    apiGet('/api/user/videos').then(setVideos).catch(()=>{});
  }, [user, nav]);

  if (!user) return null;

  return (
    <div style={{ maxWidth: 900, margin: '20px auto' }}>
      <h2>Мой профиль</h2>
      <p><strong>Email:</strong> {user.email}</p>
      <p><strong>Имя:</strong> {user.name || '-'}</p>
      <p><strong>Тип аккаунта:</strong> {user.role === 'business' ? 'Бизнес-пользователь' : (user.role === 'admin' ? 'Администратор' : 'Пользователь')}</p>
      <h3>Мои видео</h3>
      <div className="feed">
        {videos.map(v => <VideoCard key={v.id} video={v} />)}
        {videos.length === 0 && <p>Вы еще не загрузили видео.</p>}
      </div>
    </div>
  );
}
