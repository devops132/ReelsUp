
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost, apiDelete } from '../api';
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

  const commentsUI = (
    <div style={{ background:'rgba(0,0,0,.35)', borderRadius:12, padding:8 }}>
      <button title="Комментарии">{`💬 ${comments.length}`}</button>
    </div>
  );

  return (
    <div style={{ maxWidth: 1000, margin: '20px auto' }}>
      <h2>{video.title}</h2>
      <VideoPlayer video={video} onLikeToggle={onLikeToggle} onRated={onRated} commentsUI={commentsUI} />
      <p>{video.description}</p>
      {video.product_links && (
        <p><strong>Маркетплейс:</strong> <a href={video.product_links} target="_blank" rel="noreferrer">{video.product_links}</a></p>
      )}
      {video.tags && <p><strong>Теги:</strong> {video.tags}</p>}

      {/* Recommendations */}
      {recs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>Рекомендованные</h3>
          <div style={{ maxHeight: 600, overflowY: 'auto', border: '1px solid #eee', borderRadius: 8, padding: 10 }}>
            {recs.map(r => <VideoCard key={r.id} video={r} />)}
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
