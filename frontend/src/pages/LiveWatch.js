import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { apiGet } from '../api';

export default function LiveWatch() {
  const [liveStreams, setLiveStreams] = useState([]);
  const [scheduledStreams, setScheduledStreams] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const videoRef = useRef(null);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [live, scheduled] = await Promise.all([
          apiGet('/api/livestreams?status=live&limit=50'),
          apiGet('/api/livestreams?status=scheduled&limit=50')
        ]);
        setLiveStreams(live);
        setScheduledStreams(scheduled);
        setCurrentUrl((live && live.length) ? live[0].stream_url : '');
      } catch (e) {
        setError('Не удалось загрузить эфиры');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      {loading && <p>Загрузка…</p>}
      {error && <p className="error">{error}</p>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:16 }}>
        <div>
          <h3 style={{ margin: '8px 0' }}>Сейчас в эфире</h3>
          {liveStreams.length > 0 ? (
            <>
              <div>
                <video ref={videoRef} controls playsInline style={{ width:'100%', maxWidth:720, background:'#000', borderRadius:8 }} />
              </div>
              <div>
                {liveStreams.map(s => (
                  <div key={s.id} className="live-item" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontWeight:600 }}>{s.title}</div>
                      <div style={{ fontSize:13, color:'var(--text-muted)' }}>{s.user_name}</div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => setCurrentUrl(s.stream_url)}>Смотреть</button>
                      <a href={s.stream_url} target="_blank" rel="noreferrer" className="ghost-button">Открыть</a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            !loading && <p>В настоящее время трансляции не ведутся.</p>
          )}
        </div>

        <div style={{ borderTop:'1px solid var(--border-color)', marginTop:12, paddingTop:12 }} />

        <div>
          <h3 style={{ margin: '8px 0' }}>Запланированные</h3>
          {scheduledStreams.length === 0 && !loading && (
            <p>Нет запланированных трансляций.</p>
          )}
          {scheduledStreams.map(s => (
            <div key={s.id} className="live-item" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight:600 }}>{s.title}</div>
                <div style={{ fontSize:13, color:'var(--text-muted)' }}>{s.user_name}</div>
                {s.scheduled_at && <div style={{ fontSize:12, color:'var(--text-muted)' }}>Старт: {new Date(s.scheduled_at).toLocaleString('ru-RU')}</div>}
              </div>
              <span className="badge">Запланировано</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


