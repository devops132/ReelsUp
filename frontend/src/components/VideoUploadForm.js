
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
    fetch('/api/videos', {
      method: 'POST',
      headers: { 'Authorization': token ? 'Bearer ' + token : '' },
      body: fd
    }).then(async r => {
      if (r.ok) {
        const data = await r.json();
        alert(data?.message || 'Видео отправлено на модерацию');
        nav('/profile');
        return;
      }
      if (r.status === 401) {
        setError('Сессия истекла. Войдите заново.');
        nav('/login');
        return;
      }
      if (r.status === 413) {
        setError('Файл слишком большой. Уменьшите размер или свяжитесь с админом.');
        return;
      }
      const text = await r.text().catch(() => '');
      setError(text || ('Не удалось загрузить видео (код ' + r.status + ')'));
    }).catch(err => {
      setError('Не удалось загрузить видео');
      // optional: console for diagnostics
      try { console.error('upload error', err); } catch {}
    });
  };

  if (!user) return null;

  return (
    <form onSubmit={submit} className="form">
      <h2>Загрузка видео</h2>
      {error && <p style={{color:'red'}}>{error}</p>}
      <label>Видео файл<input type="file" accept="video/*" onChange={e=>setFile(e.target.files[0])} required /></label>
      <label>Заголовок<input value={title} onChange={e=>setTitle(e.target.value)} required /></label>
      <label>Описание<textarea value={description} onChange={e=>setDescription(e.target.value)} rows="3" /></label>
      <label>Теги<input value={tags} onChange={e=>{
        const raw = e.target.value;
        const parts = raw.split(/[,\s]+/).filter(Boolean).map(t => t.startsWith('#') ? t : ('#'+t));
        setTags(parts.join(', '));
      }} placeholder="tag1, tag2" /></label>
      <label>Ссылка на маркетплейс<input value={productLinks} onChange={e=>setProductLinks(e.target.value)} placeholder="https://..." /></label>
      <label>Категория<select value={category} onChange={e=>setCategory(e.target.value)}>
        <option value="">-- Не выбрана --</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select></label>
      <button type="submit">Загрузить</button>
    </form>
  );
}
