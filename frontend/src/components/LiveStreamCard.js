import React from 'react';

function formatDateTime(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (e) {
    return value;
  }
}

export default function LiveStreamCard({ stream, compact = false }) {
  const status = stream.status || 'scheduled';
  const statusLabel = status === 'live' ? 'В эфире' : status === 'ended' ? 'Завершено' : 'Скоро старт';
  const statusClass = status === 'live' ? 'live' : status === 'ended' ? 'ended' : 'scheduled';
  const description = (stream.description || '').trim();
  const shortDescription = description.length > 140 ? description.slice(0, 137) + '…' : description;

  return (
    <div className={compact ? 'live-card compact' : 'live-card'}>
      <a
        href={stream.stream_url}
        target="_blank"
        rel="noopener noreferrer"
        className="live-thumb"
        aria-label={`Открыть трансляцию ${stream.title}`}
      >
        {stream.thumbnail_url ? (
          <img src={stream.thumbnail_url} alt={stream.title} />
        ) : (
          <div className="live-thumb-placeholder">
            <span role="img" aria-hidden="true">📡</span>
          </div>
        )}
        <span className={`live-badge ${statusClass}`}>{statusLabel}</span>
      </a>
      <div className="live-body">
        <h3>{stream.title}</h3>
        {shortDescription && <p>{shortDescription}</p>}
        <small className="live-meta">Автор: {stream.user_name || '—'}</small>
        {status === 'scheduled' && stream.scheduled_at && (
          <small className="live-meta">Старт: {formatDateTime(stream.scheduled_at)}</small>
        )}
        {status === 'live' && stream.started_at && (
          <small className="live-meta">В эфире с {formatDateTime(stream.started_at)}</small>
        )}
        {status === 'ended' && stream.ended_at && (
          <small className="live-meta">Завершено: {formatDateTime(stream.ended_at)}</small>
        )}
      </div>
    </div>
  );
}

