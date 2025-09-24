import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '../api';
import LiveStreamCard from './LiveStreamCard';

export default function LiveStreamsBlock() {
  const [liveStreams, setLiveStreams] = useState([]);
  const [scheduledStreams, setScheduledStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const abortRef = useRef({ cancelled: false });

  const fetchStreams = useCallback(async (silent = false) => {
    const abortSignal = abortRef.current;
    if (!silent) {
      setLoading(true);
    }
    setError('');
    try {
      const [liveData, scheduledData] = await Promise.all([
        apiGet('/api/livestreams?status=live&limit=6'),
        apiGet('/api/livestreams?status=scheduled&limit=6')
      ]);
      if (abortSignal.cancelled) return;
      setLiveStreams(liveData);
      setScheduledStreams(scheduledData);
    } catch (err) {
      if (abortSignal.cancelled) return;
      if (!silent) {
        setError('Не удалось загрузить трансляции');
      }
    } finally {
      if (abortSignal.cancelled) return;
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    abortRef.current.cancelled = false;
    fetchStreams(false);
    const timer = setInterval(() => fetchStreams(true), 60000);
    return () => {
      abortRef.current.cancelled = true;
      clearInterval(timer);
    };
  }, [fetchStreams]);

  const hasContent = liveStreams.length > 0 || scheduledStreams.length > 0;

  if (!loading && !hasContent && !error) {
    return null;
  }

  return (
    <section className="live-block">
      <div className="live-block-header">
        <h2>Прямые эфиры</h2>
        <div className="live-block-actions">
          {loading && <span className="live-loading">Обновляем…</span>}
          <button type="button" className="ghost-button" onClick={() => fetchStreams(false)}>
            Обновить
          </button>
        </div>
      </div>
      {error && <p className="live-error">{error}</p>}
      {liveStreams.length > 0 && (
        <>
          <h3 className="live-subtitle">В эфире сейчас</h3>
          <div className="live-grid">
            {liveStreams.map(stream => (
              <LiveStreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        </>
      )}
      {scheduledStreams.length > 0 && (
        <>
          <h3 className="live-subtitle">Скоро стартуют</h3>
          <div className="live-grid scheduled">
            {scheduledStreams.map(stream => (
              <LiveStreamCard key={`scheduled-${stream.id}`} stream={stream} compact />
            ))}
          </div>
        </>
      )}
      {!loading && !error && !hasContent && (
        <p className="live-empty">Сейчас нет активных или запланированных трансляций.</p>
      )}
    </section>
  );
}

