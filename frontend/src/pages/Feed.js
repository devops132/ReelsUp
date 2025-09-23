
import React, { useEffect, useState } from 'react';
import { apiGet } from '../api';
import VideoCard from '../components/VideoCard';
import VideoSkeleton from '../components/VideoSkeleton';

export default function Feed() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [sort, setSort] = useState('new');

  useEffect(() => {
    load();
    fetch('/api/categories').then(r=>r.json()).then(setCategories).catch(()=>{});
  }, []);

  const load = (qq='', cc='', ss=sort) => {
    setLoading(true);
    let url = '/api/videos';
    const params = [];
    if (qq) params.push('q='+encodeURIComponent(qq));
    if (cc) params.push('category='+cc);
    if (ss === 'likes') params.push('sort=likes');
    if (params.length) url += '?' + params.join('&');
    apiGet(url)
      .then(data => { setVideos(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const search = (e) => { e.preventDefault(); load(q, category); };

  return (
    <div>
      <h1 className="section-header">Лента ReelsUp</h1>
      <form onSubmit={search} style={{ textAlign:'center', marginTop:10 }}>
        <input placeholder="Поиск..." value={q} onChange={e=>setQ(e.target.value)} />
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{ marginLeft: 6 }}>
          <option value="">Все категории</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sort} onChange={e=>{ setSort(e.target.value); load(q, category, e.target.value); }} style={{ marginLeft: 6 }}>
          <option value="new">Новые</option>
          <option value="likes">По лайкам</option>
        </select>
        <button style={{ marginLeft: 6 }}>Найти</button>
      </form>
      <div className="feed">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <VideoSkeleton key={i} />)
          : videos.map(v => <VideoCard key={v.id} video={v} />)}
      </div>
    </div>
  );
}
