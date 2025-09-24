
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost, apiDelete } from '../api';
import { IconCopy } from '../components/Icons';
import VideoPlayer from '../components/VideoPlayer';
import VideoCard from '../components/VideoCard';

export default function VideoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [video, setVideo] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [err, setErr] = useState('');
  const [recs, setRecs] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [editCategory, setEditCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [editTags, setEditTags] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resumeTime, setResumeTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [swipeQueue, setSwipeQueue] = useState([]);
  const [historyStack, setHistoryStack] = useState([]);
  const [forwardStack, setForwardStack] = useState([]);
  const playbackPositionsRef = useRef({});
  const pendingResumeRef = useRef(null);
  const isNavigatingRef = useRef(false);
  const navIntentRef = useRef(null);
  const playerAreaRef = useRef(null);
  const touchStateRef = useRef({ active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 });
  const currentTimeRef = useRef(0);

  const load = async () => {
    try {
      setErr('');
      const v = await apiGet('/api/videos/' + id);
      setVideo(v);
      const c = await apiGet('/api/videos/' + id + '/comments');
      setComments(c);
      // recommendations: same category, exclude current, sort by likes
      const rec = await apiGet(`/api/videos?category=${v.category_id || ''}&exclude=${id}&sort=likes`);
      const filtered = rec.filter(x => x.id !== Number(id)).slice(0, 20);
      setRecs(filtered);
      const knownIds = new Set([Number(id)]);
      historyStack.forEach(item => knownIds.add(Number(item.id)));
      forwardStack.forEach(item => knownIds.add(Number(item.id)));
      setSwipeQueue(filtered.filter(x => !knownIds.has(Number(x.id))));
      const pendingResume = pendingResumeRef.current;
      const storedResume = playbackPositionsRef.current[v.id] || 0;
      const nextResume = pendingResume != null ? pendingResume : storedResume;
      pendingResumeRef.current = null;
      setResumeTime(nextResume);
      currentTimeRef.current = nextResume || 0;
      isNavigatingRef.current = false;
      navIntentRef.current = null;
    } catch {
      setErr('Видео не найдено или недоступно');
      isNavigatingRef.current = false;
      navIntentRef.current = null;
      pendingResumeRef.current = null;
    }
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (!navIntentRef.current) {
      setHistoryStack([]);
      setForwardStack([]);
    }
  }, [id]);
  useEffect(() => { fetch('/api/categories').then(r=>r.json()).then(setCategories).catch(()=>{}); }, []);

  const addComment = async (e) => {
    e.preventDefault();
    if (!user) { alert('Войдите'); return; }
    if (!text.trim()) return;
    try {
      const c = await apiPost('/api/videos/' + id + '/comments', { text });
      setComments([...comments, c]); setText('');
    } catch {}
  };

  const handleProgress = useCallback((time) => {
    currentTimeRef.current = time;
    if (video) {
      playbackPositionsRef.current[video.id] = time;
    }
  }, [video]);

  const handleFullscreenChange = useCallback((value) => {
    setIsFullscreen(Boolean(value));
  }, []);

  const handleSwipeUp = useCallback(() => {
    if (!video) return;
    if (!isFullscreen) return;
    if (typeof window !== 'undefined' && window.innerWidth > 900) return;
    if (isNavigatingRef.current) return;

    let targetId = null;
    let resumeAt = 0;

    if (forwardStack.length) {
      const nextForward = forwardStack[forwardStack.length - 1];
      targetId = Number(nextForward.id);
      resumeAt = typeof nextForward.time === 'number'
        ? nextForward.time
        : (playbackPositionsRef.current[targetId] || 0);
      setForwardStack(prev => prev.slice(0, -1));
    } else if (swipeQueue.length) {
      const nextVideo = swipeQueue[0];
      targetId = Number(nextVideo.id);
      resumeAt = playbackPositionsRef.current[targetId] || 0;
      setSwipeQueue(prev => prev.slice(1));
    }

    if (!targetId || targetId === Number(video.id)) return;

    const currentVal = currentTimeRef.current;
    playbackPositionsRef.current[video.id] = currentVal;
    setHistoryStack(prev => [...prev, { id: Number(video.id), time: currentVal }]);
    pendingResumeRef.current = resumeAt;
    navIntentRef.current = { type: 'next', targetId };
    isNavigatingRef.current = true;
    navigate(`/video/${targetId}`);
  }, [video, isFullscreen, forwardStack, swipeQueue, navigate]);

  const handleSwipeDown = useCallback(() => {
    if (!video) return;
    if (!isFullscreen) return;
    if (typeof window !== 'undefined' && window.innerWidth > 900) return;
    if (isNavigatingRef.current) return;
    if (!historyStack.length) return;

    const prevEntry = historyStack[historyStack.length - 1];
    const prevId = Number(prevEntry.id);
    const currentVal = currentTimeRef.current;
    playbackPositionsRef.current[video.id] = currentVal;
    setHistoryStack(prev => prev.slice(0, -1));
    setForwardStack(prev => [...prev, { id: Number(video.id), time: currentVal }]);
    const resumeAt = typeof prevEntry.time === 'number'
      ? prevEntry.time
      : (playbackPositionsRef.current[prevId] || 0);
    pendingResumeRef.current = resumeAt;
    navIntentRef.current = { type: 'prev', targetId: prevId };
    isNavigatingRef.current = true;
    navigate(`/video/${prevId}`);
  }, [video, isFullscreen, historyStack, navigate]);

  useEffect(() => {
    const node = playerAreaRef.current;
    if (!node) return undefined;
    const state = touchStateRef.current;

    const mobileActive = () => {
      if (!isFullscreen) return false;
      if (typeof window === 'undefined') return false;
      return window.innerWidth <= 900;
    };

    const onTouchStart = (event) => {
      if (!mobileActive()) { state.active = false; return; }
      const touch = event.touches[0];
      if (!touch) return;
      state.startX = touch.clientX;
      state.startY = touch.clientY;
      state.lastX = touch.clientX;
      state.lastY = touch.clientY;
      state.active = true;
    };

    const onTouchMove = (event) => {
      if (!state.active) return;
      const touch = event.touches[0];
      if (!touch) return;
      state.lastX = touch.clientX;
      state.lastY = touch.clientY;
    };

    const onTouchEnd = () => {
      if (!state.active) return;
      const deltaY = (state.lastY ?? state.startY) - state.startY;
      const deltaX = (state.lastX ?? state.startX) - state.startX;
      state.active = false;
      if (!mobileActive()) return;
      const threshold = 60;
      if (Math.abs(deltaY) < threshold || Math.abs(deltaY) < Math.abs(deltaX)) return;
      if (deltaY < 0) handleSwipeUp(); else handleSwipeDown();
    };

    const onTouchCancel = () => { state.active = false; };

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: true });
    node.addEventListener('touchend', onTouchEnd);
    node.addEventListener('touchcancel', onTouchCancel);

    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [isFullscreen, handleSwipeUp, handleSwipeDown]);

  const delComment = async (cid) => {
    if (!user) return;
    if (!window.confirm('Удалить комментарий?')) return;
    try {
      await apiDelete('/api/videos/' + id + '/comments/' + cid);
      setComments(comments.filter(c => c.id !== cid));
    } catch {}
  };

  const startEdit = (c) => {
    setEditingId(c.id); setEditText(c.text);
  };
  const saveEdit = async () => {
    if (!editingId || !editText.trim()) { setEditingId(null); return; }
    try {
      const res = await fetch(`/api/videos/${id}/comments/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(user ? {'Authorization':'Bearer '+localStorage.getItem('authToken')} : {}) },
        body: JSON.stringify({ text: editText })
      });
      if (res.ok) {
        setComments(comments.map(c => c.id === editingId ? { ...c, text: editText } : c));
        setEditingId(null); setEditText('');
      }
    } catch {}
  };

  const onLikeToggle = (res) => {
    setVideo({
      ...video,
      likes_count: res.likes_count,
      dislikes_count: res.dislikes_count,
      liked_by_user: res.liked,
      disliked_by_user: res.disliked
    });
  };
  const onRated = (res) => {
    setVideo({ ...video, my_rating: res.my_rating, avg_rating: res.avg_rating });
  };

  if (err) return <p style={{ color:'red', textAlign:'center' }}>{err}</p>;
  if (!video) return <p style={{ textAlign:'center' }}>Загрузка...</p>;
  const commentsUI = (
    <div style={{ background:'transparent', borderRadius:12 }}>
      <button title="Комментарии" onClick={()=>setDrawerOpen(true)}>{`💬 ${comments.length}`}</button>
    </div>
  );

  return (
    <div className="video-page">
      <div>
        <h2>{video.title}</h2>
        <div ref={playerAreaRef} style={{ position:'relative' }}>
          <VideoPlayer
            video={video}
            onLikeToggle={onLikeToggle}
            onRated={onRated}
            commentsUI={commentsUI}
            resumeTime={resumeTime}
            onProgress={handleProgress}
            onFullscreenChange={handleFullscreenChange}
          />
        </div>
      {!editMode ? (
        <>
          <p>{video.description}</p>
          {(user && (user.id === video.user_id || user.role === 'admin')) && (
            <button onClick={() => { setEditMode(true); setEditCategory(String(video.category_id||'')); setEditTags(video.tags||''); setEditDesc(video.description||''); }}>
              Редактировать метаданные
            </button>
          )}
        </>
      ) : (
        <div style={{ border:'1px solid #ddd', padding:10, borderRadius:8 }}>
          <h3>Редактирование метаданных</h3>
          <label>Категория
            <select value={editCategory} onChange={e=>setEditCategory(e.target.value)} style={{ marginLeft: 6 }}>
              <option value="">-- Без категории --</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <br/>
          <label>Теги
            <input value={editTags} onChange={e=>setEditTags(e.target.value)} placeholder="tag1, tag2" style={{ marginLeft: 6, width:'60%' }} />
          </label>
          <br/>
          <label>Описание
            <textarea value={editDesc} onChange={e=>setEditDesc(e.target.value)} rows="3" style={{ display:'block', width:'80%' }} />
          </label>
          <div style={{ marginTop: 8 }}>
            <button onClick={async ()=>{
              const body = {
                category_id: editCategory ? Number(editCategory) : 0,
                tags: editTags,
                description: editDesc
              };
              const res = await fetch(`/api/videos/${id}`, { method:'PUT', headers:{ 'Content-Type':'application/json', ...(localStorage.getItem('authToken') ? { 'Authorization':'Bearer '+localStorage.getItem('authToken') } : {}) }, body: JSON.stringify(body) });
              if (res.ok) {
                const v = await res.json();
                setVideo(v);
                setEditMode(false);
              } else {
                alert('Не удалось сохранить');
              }
            }}>Сохранить</button>
            <button onClick={()=>setEditMode(false)} style={{ marginLeft: 6 }}>Отмена</button>
          </div>
        </div>
      )}
      {video.product_links && (
        <p><strong>Маркетплейс:</strong> <a href={video.product_links} target="_blank" rel="noreferrer">{video.product_links}</a> <button title="Копировать ссылку" onClick={async()=>{ try { await navigator.clipboard.writeText(video.product_links); } catch {} }} style={{ marginLeft:8, display:'inline-flex', alignItems:'center', gap:6, background:'var(--surface-2)' }}><IconCopy /></button></p>
      )}
      {video.tags && <p><strong>Теги:</strong> {video.tags}</p>}

      </div>
      {/* Recommendations sticky */}
      <div className="sidebar">
        {recs.length > 0 && (
          <div>
            <h3>Рекомендованные</h3>
            <div style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', border: '1px solid #eee', borderRadius: 8, padding: 10 }}>
              {recs.map(r => <VideoCard key={r.id} video={r} />)}
            </div>
          </div>
        )}
      </div>
      {/* Comments drawer (mobile-first) */}
      {drawerOpen && (
        <div style={{ position:'fixed', left:0, right:0, bottom:0, top:'30%', background:'rgba(0,0,0,.6)', zIndex:50 }} onClick={()=>setDrawerOpen(false)}>
          <div style={{ position:'absolute', left:0, right:0, bottom:0, background:'var(--surface-1)', borderTopLeftRadius:16, borderTopRightRadius:16, maxHeight:'70%', overflowY:'auto', padding:16 }} onClick={(e)=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3>Комментарии ({comments.length})</h3>
              <button onClick={()=>setDrawerOpen(false)}>Закрыть</button>
            </div>
            <div>
              {comments.map(c => (
                <div key={c.id} className="comment">
                  <div><span className="comment-author">{c.user.name}</span>: <span>{c.text}</span></div>
                  <div style={{ fontSize: '.8em', color: '#8899aa' }}>{new Date(c.created_at).toLocaleString()}</div>
                </div>
              ))}
              {comments.length === 0 && <p>Комментариев пока нет.</p>}
            </div>
          </div>
        </div>
      )}
      <h3>Комментарии ({comments.length})</h3>
      <div>
        {comments.map(c => (
          <div key={c.id} className="comment">
            <div><span className="comment-author">{c.user.name}</span>: <span>{c.text}</span></div>
            <div style={{ fontSize: '.8em', color: '#8899aa' }}>{new Date(c.created_at).toLocaleString()}</div>
            {user && (user.id === c.user.id || user.role === 'admin') && (
              <div style={{ marginTop: 4 }}>
                {editingId === c.id ? (
                  <>
                    <input value={editText} onChange={e=>setEditText(e.target.value)} style={{ width:'70%' }} />
                    <button onClick={saveEdit} style={{ marginLeft: 6 }}>Сохранить</button>
                    <button onClick={()=>{setEditingId(null); setEditText('');}} style={{ marginLeft: 6 }}>Отмена</button>
                  </>
                ) : (
                  <>
                    <button onClick={()=>startEdit(c)}>Редактировать</button>
                    <button onClick={()=>delComment(c.id)} style={{ marginLeft: 6, background:'#e88' }}>Удалить</button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {comments.length === 0 && <p>Комментариев пока нет.</p>}
      </div>
      {user ? (
        <form onSubmit={addComment} style={{ marginTop: 10 }}>
          <input value={text} onChange={e=>setText(e.target.value)} placeholder="Ваш комментарий..." style={{ width: '80%' }} />
          <button type="submit">Отправить</button>
        </form>
      ) : <p>Войдите, чтобы комментировать.</p>}
    </div>
  );
}
