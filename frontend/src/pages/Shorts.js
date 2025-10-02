import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../api';
import LeftSidebar from '../components/LeftSidebar';
import ShortsViewer from '../components/ShortsViewer';

export default function Shorts() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openViewer, setOpenViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    setLoading(true);
    apiGet('/api/videos')
      .then(data => {
        const onlyReels = (data || []).filter(v => (v.reel === 1 || v.reel === true || v.is_reel === 1 || v.is_reel === true));
        setVideos(onlyReels);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const openAt = (idx) => { setViewerIndex(idx); setOpenViewer(true); };
  const closeViewer = () => setOpenViewer(false);

  if (openViewer) {
    return <ShortsViewer videos={videos} startIndex={viewerIndex} onExit={closeViewer} />;
  }

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
            : videos.map((v, idx) => (
                <button key={v.id} className="shorts-card" onClick={() => openAt(idx)}>
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
                </button>
              ))}
        </div>
      </div>
    </div>
  );
}


