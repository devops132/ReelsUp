
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost, apiDelete } from '../api';
import { IconCopy } from '../components/Icons';
import VideoPlayer from '../components/VideoPlayer';
import VideoCard from '../components/VideoCard';

export default function VideoPage() {
  const { id } = useParams();
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

  const load = async () => {
    try {
      const v = await apiGet('/api/videos/' + id);
      setVideo(v);
      const c = await apiGet('/api/videos/' + id + '/comments');
      setComments(c);
      // recommendations: same category, exclude current, sort by likes
      const rec = await apiGet(`/api/videos?category=${v.category_id || ''}&exclude=${id}&sort=likes`);
      setRecs(rec.filter(x => x.id !== Number(id)).slice(0, 20));
    } catch {
      setErr('Видео не найдено или недоступно');
    }
  };

  useEffect(() => { load(); }, [id]);
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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const commentsUI = (
    <div style={{ background:'transparent', borderRadius:12 }}>
      <button title="Комментарии" onClick={()=>setDrawerOpen(true)}>{`💬 ${comments.length}`}</button>
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '20px auto', position:'relative', display:'grid', gridTemplateColumns:'1fr 360px', gap:24 }}>
      <div>
        <h2>{video.title}</h2>
        <VideoPlayer video={video} onLikeToggle={onLikeToggle} onRated={onRated} commentsUI={commentsUI} />
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
      <div style={{ position:'sticky', top:72, alignSelf:'start' }}>
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
