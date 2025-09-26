import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiPost, apiPut } from '../api';

export default function GoLive() {
  const { user, token } = useAuth();
  const [title, setTitle] = useState('Мой прямой эфир');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('idle'); // idle | starting | live | stopping
  const [error, setError] = useState('');
  const [streamPath, setStreamPath] = useState('stream'); // room name
  const [createdStream, setCreatedStream] = useState(null);
  const pcRef = useRef(null);
  const videoRef = useRef(null);
  const mediaRef = useRef(null);

  useEffect(() => {
    return () => {
      try {
        if (pcRef.current) pcRef.current.close();
      } catch {}
      if (mediaRef.current) {
        mediaRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startPublishing = async () => {
    if (!user) { setError('Нужно войти в систему'); return; }
    setError('');
    setStatus('starting');
    try {
      // 1) Capture camera+mic
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      mediaRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(()=>{});
      }
      // 2) Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
      });
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 3) Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 4) Send WHIP request
      // Try multiple endpoint formats supported by MediaMTX
      const candidateUrls = [
        `/${encodeURIComponent(streamPath)}/whip`,
        `/whip/${encodeURIComponent(streamPath)}`,
        `/whip?path=${encodeURIComponent(streamPath)}`
      ];
      let resp = null;
      let lastErr = '';
      for (const url of candidateUrls) {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp', 'Accept': 'application/sdp' },
          body: offer.sdp
        });
        if (r.ok) { resp = r; break; }
        const txt = await r.text().catch(()=>' ');
        lastErr = `${r.status}${txt ? ' - ' + txt : ''}`;
      }
      if (!resp) {
        throw new Error(`WHIP error: ${lastErr || 'unknown'}`);
      }
      const answerSdp = await resp.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // 5) Create backend live stream record if not exists
      const streamUrl = `${window.location.origin}/hls/${encodeURIComponent(streamPath)}/index.m3u8`;
      const payload = { title, description, stream_url: streamUrl, status: 'live' };
      const created = await apiPost('/api/livestreams', payload);
      setCreatedStream(created);
      setStatus('live');
    } catch (e) {
      console.error(e);
      setError(e.message || 'Не удалось запустить эфир');
      setStatus('idle');
    }
  };

  const stopPublishing = async () => {
    setStatus('stopping');
    try {
      if (pcRef.current) {
        pcRef.current.getSenders().forEach(s => { try { s.track && s.track.stop(); } catch {} });
        pcRef.current.close();
      }
      if (mediaRef.current) {
        mediaRef.current.getTracks().forEach(t => t.stop());
      }
      if (createdStream) {
        await apiPut(`/api/livestreams/${createdStream.id}/status`, { status: 'ended' });
      }
    } catch {}
    setStatus('idle');
    setCreatedStream(null);
  };

  return (
    <div className="page go-live">
      <h1>Прямой эфир из браузера</h1>
      {!user && <p>Войдите, чтобы начать трансляцию.</p>}
      <div className="form-grid">
        <label>
          Название
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Название эфира" />
        </label>
        <label>
          Описание
          <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="О чём эфир?" />
        </label>
        <label>
          Идентификатор потока
          <input value={streamPath} onChange={e=>setStreamPath(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))} placeholder="stream" />
          <small>URL просмотра: /live/{streamPath}/index.m3u8</small>
        </label>
      </div>
      <div className="preview">
        <video ref={videoRef} playsInline muted autoPlay style={{ width:'100%', maxWidth:480, background:'#000', borderRadius:8 }} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        {status !== 'live' ? (
          <button onClick={startPublishing} disabled={!user || status==='starting'}>
            {status==='starting' ? 'Запуск…' : 'Начать эфир'}
          </button>
        ) : (
          <button onClick={stopPublishing} disabled={status==='stopping'}>
            {status==='stopping' ? 'Остановка…' : 'Завершить эфир'}
          </button>
        )}
        {createdStream && (
          <a href={createdStream.stream_url} target="_blank" rel="noreferrer" style={{ marginLeft:12 }}>Открыть поток</a>
        )}
      </div>
    </div>
  );
}


