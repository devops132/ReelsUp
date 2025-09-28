import React, { useEffect, useState } from 'react';
import { apiGet } from '../api';
import LeftSidebar from '../components/LeftSidebar';

export default function Shorts() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGet('/api/videos')
      .then(data => { setVideos(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="page-with-sidebar">
      <LeftSidebar />
      <div className="page-content">
        <h1 className="section-header">Шортсы</h1>
        <div className="shorts-grid">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shorts-card animate-pulse">
                  <div className="thumb-vertical bg-gray-300" />
                  <div style={{ padding: '10px 12px' }}>
                    <div className="h-4 w-3/4 rounded mb-2 bg-gray-300" />
                    <div className="h-3 w-1/2 rounded bg-gray-300" />
                  </div>
                </div>
              ))
            : videos.map(v => (
                <a key={v.id} href={`/video/${v.id}`} className="shorts-card">
                  <div className="thumb-vertical">
                    {v.thumbnail_url ? (
                      <img src={v.thumbnail_url} alt={v.title} />
                    ) : (
                      <div className="live-thumb-placeholder">▶</div>
                    )}
                  </div>
                  <div className="shorts-content">
                    <h3 title={v.title}>{v.title}</h3>
                    <small>{v.author_name || 'Автор'}</small>
                  </div>
                </a>
              ))}
        </div>
      </div>
    </div>
  );
}


