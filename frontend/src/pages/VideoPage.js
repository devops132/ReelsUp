
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost, apiDelete } from '../api';
import VideoPlayer from '../components/VideoPlayer';

export default function VideoPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [video, setVideo] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    apiGet('/api/videos/' + id).then(setVideo).catch(()=> setErr('Видео не найдено или недоступно'));
    apiGet('/api/videos/' + id + '/comments').then(setComments).catch(()=>{});
  }, [id]);

  const addComment = async (e) => {
    e.preventDefault();
    if (!user) { alert('Войдите'); return; }
    if (!text.trim()) return;
    try {
      const c = await apiPost('/api/videos/' + id + '/comments', { text });
      setComments([...comments, c]); setText('');
    } catch {}
  };

  const toggleLike = async () => {
    if (!user) { alert('Войдите'); return; }
    try {
      if (!video.liked_by_user) {
        const res = await apiPost('/api/videos/' + id + '/like', {});
        setVideo({ ...video, likes_count: res.likes_count, liked_by_user: true });
      } else {
        const res = await apiDelete('/api/videos/' + id + '/like');
        setVideo({ ...video, likes_count: res.likes_count, liked_by_user: false });
      }
    } catch {}
  };

  if (err) return <p style={{color:'red', textAlign:'center'}}>{err}</p>;
  if (!video) return <p style={{textAlign:'center'}}>Загрузка...</p>;

  const links = video.product_links ? video.product_links.split(/[,\s]+/).filter(x => x.startsWith('http')) : [];

  return (
    <div style={{ maxWidth: 900, margin: '20px auto' }}>
      <h2>{video.title}</h2>
      <VideoPlayer src={`/api/videos/${video.id}/content`} />
      <p>{video.description}</p>
      {video.tags && <p><strong>Теги:</strong> {video.tags}</p>}
      {links.length > 0 && <p><strong>Ссылки на товар:</strong> {links.map((l,i)=>(<span key={i}><a href={l} target="_blank" rel="noreferrer">{l}</a>{i<links.length-1?', ':''}</span>))}</p>}
      <p><strong>Автор:</strong> {video.user_name} {video.category_name && <>| <strong>Категория:</strong> {video.category_name}</>}</p>
      <p><strong>Лайки:</strong> {video.likes_count} {user && <button onClick={toggleLike}>{video.liked_by_user ? 'Убрать лайк' : 'Лайк'}</button>}</p>

      <h3>Комментарии ({comments.length})</h3>
      <div>
        {comments.map(c => (
          <div key={c.id} className="comment">
            <span className="comment-author">{c.user.name}</span>: <span>{c.text}</span>
            <div style={{ fontSize: '.8em', color: '#8899aa' }}>{new Date(c.created_at).toLocaleString()}</div>
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
