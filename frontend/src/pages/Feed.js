
import React, { useEffect, useState } from 'react';
import { apiGet } from '../api';
import VideoCard from '../components/VideoCard';

export default function Feed() {
  const [videos, setVideos] = useState([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    load();
    fetch('/api/categories').then(r=>r.json()).then(setCategories).catch(()=>{});
  }, []);

  const load = (qq='', cc='') => {
    let url = '/api/videos';
    const params = [];
    if (qq) params.push('q='+encodeURIComponent(qq));
    if (cc) params.push('category='+cc);
    if (params.length) url += '?' + params.join('&');
    apiGet(url).then(setVideos).catch(()=>{});
  };

  const search = (e) => { e.preventDefault(); load(q, category); };

  return (
    <div>
      <form onSubmit={search} style={{ textAlign:'center', marginTop:10 }}>
        <input placeholder="Поиск..." value={q} onChange={e=>setQ(e.target.value)} />
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{ marginLeft: 6 }}>
          <option value="">Все категории</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button style={{ marginLeft: 6 }}>Найти</button>
      </form>
      <div className="feed">
        {videos.map(v => <VideoCard key={v.id} video={v} />)}
      </div>
    </div>
  );
}
