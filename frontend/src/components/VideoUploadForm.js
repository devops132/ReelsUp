
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function VideoUploadForm() {
  const { user, token } = useAuth();
  const nav = useNavigate();
  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [productLinks, setProductLinks] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (!user) { nav('/login'); return; }
    fetch('/api/categories').then(r=>r.json()).then(setCategories).catch(()=>{});
  }, [user, nav]);

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!file) { setError('Выберите файл видео'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    fd.append('description', description);
    fd.append('tags', tags);
    fd.append('productLinks', productLinks);
    fd.append('category', category);
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/videos');
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      setUploading(true);
      setUploadProgress(0);

      xhr.upload.onprogress = (evt) => {
        if (evt && evt.lengthComputable) {
          const percent = Math.round((evt.loaded / evt.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        setUploading(false);
        const status = xhr.status || 0;
        if (status >= 200 && status < 300) {
          let data = null;
          try { data = JSON.parse(xhr.responseText || '{}'); } catch {}
          alert((data && data.message) || 'Видео отправлено на модерацию');
          nav('/profile');
          return;
        }
        if (status === 401) {
          setError('Сессия истекла. Войдите заново.');
          nav('/login');
          return;
        }
        if (status === 413) {
          setError('Файл слишком большой. Уменьшите размер или свяжитесь с админом.');
          return;
        }
        const text = xhr.responseText || '';
        setError(text || ('Не удалось загрузить видео (код ' + status + ')'));
      };

      xhr.onerror = () => {
        setUploading(false);
        setError('Не удалось загрузить видео');
        try { console.error('upload error'); } catch {}
      };

      xhr.send(fd);
    } catch (err) {
      setUploading(false);
      setError('Не удалось загрузить видео');
      try { console.error('upload error', err); } catch {}
    }
  };

  if (!user) return null;

  return (
    <form onSubmit={submit} className="form">
      <h2>Загрузка видео</h2>
      {error && <p style={{color:'red'}}>{error}</p>}
      <label>Видео файл<input type="file" accept="video/*" onChange={e=>setFile(e.target.files[0])} required disabled={uploading} /></label>
      <label>Заголовок<input value={title} onChange={e=>setTitle(e.target.value)} required disabled={uploading} /></label>
      <label>Описание<textarea value={description} onChange={e=>setDescription(e.target.value)} rows="3" disabled={uploading} /></label>
      <label>Теги<input value={tags} onChange={e=>{
        const raw = e.target.value;
        const parts = raw.split(/[,\s]+/).filter(Boolean).map(t => t.startsWith('#') ? t : ('#'+t));
        setTags(parts.join(', '));
      }} placeholder="tag1, tag2" disabled={uploading} /></label>
      <label>Ссылка на маркетплейс<input value={productLinks} onChange={e=>setProductLinks(e.target.value)} placeholder="https://..." disabled={uploading} /></label>
      <label>Категория<select value={category} onChange={e=>setCategory(e.target.value)} disabled={uploading}>
        <option value="">-- Не выбрана --</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select></label>
      {uploading && (
        <div style={{marginTop: 10}}>
          <div style={{height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden'}}>
            <div style={{height: '100%', width: (uploadProgress||0) + '%', background: '#4caf50', transition: 'width 0.2s'}} />
          </div>
          <div style={{fontSize: 12, marginTop: 4}}>{uploadProgress}%</div>
        </div>
      )}
      <button type="submit" disabled={uploading}>Загрузить</button>
    </form>
  );
}
