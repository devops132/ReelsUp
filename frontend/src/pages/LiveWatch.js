import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { apiGet } from '../api';

export default function LiveWatch() {
  const [streams, setStreams] = useState([]);
  const [mode, setMode] = useState('live'); // 'live' | 'scheduled'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const videoRef = useRef(null);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const list = await apiGet(`/api/livestreams?status=${mode}&limit=50`);
        setStreams(list);
      } catch (e) {
        setError('Не удалось загрузить эфиры');
      } finally {
        setLoading(false);
      }
    })();
  }, [mode]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !currentUrl) return;
    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true });
      hls.loadSource(currentUrl);
      hls.attachMedia(el);
      return () => { hls.destroy(); };
    } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = currentUrl;
      el.play().catch(()=>{});
    }
  }, [currentUrl]);

  return (
    <div className="page live-watch">
      <h1>Эфиры</h1>
      <div style={{ display:'flex', gap:8, margin:'8px 0 16px' }}>
        <button className={mode==='live' ? 'primary' : ''} onClick={()=>setMode('live')}>Сейчас в эфире</button>
        <button className={mode==='scheduled' ? 'primary' : ''} onClick={()=>setMode('scheduled')}>Запланированные</button>
      </div>
      {loading && <p>Загрузка…</p>}
      {error && <p className="error">{error}</p>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:16 }}>
        {mode === 'live' && (
          <div>
            <video ref={videoRef} controls playsInline style={{ width:'100%', maxWidth:720, background:'#000', borderRadius:8 }} />
          </div>
        )}
        <div>
          {streams.length === 0 && !loading && (
            <p>{mode==='live' ? 'Нет активных трансляций.' : 'Нет запланированных трансляций.'}</p>
          )}
          {streams.map(s => (
            <div key={s.id} className="live-item" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight:600 }}>{s.title}</div>
                <div style={{ fontSize:13, color:'var(--text-muted)' }}>{s.user_name}</div>
                {mode==='scheduled' && s.scheduled_at && <div style={{ fontSize:12, color:'var(--text-muted)' }}>Старт: {new Date(s.scheduled_at).toLocaleString('ru-RU')}</div>}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {mode==='live' ? (
                  <>
                    <button onClick={() => setCurrentUrl(s.stream_url)}>Смотреть</button>
                    <a href={s.stream_url} target="_blank" rel="noreferrer" className="ghost-button">Открыть</a>
                  </>
                ) : (
                  <span className="badge">Запланировано</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


