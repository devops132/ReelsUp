import React, { useEffect, useState } from 'react';
import { apiGet } from '../api';
import VideoCard from '../components/VideoCard';
import VideoCardSkeleton from '../components/VideoCardSkeleton';

export default function Feed() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    load();
    fetch('/api/categories').then(r=>r.json()).then(setCategories).catch(()=>{});
  }, []);

  const load = (qq='', cc='') => {
    setLoading(true);
    let url = '/api/videos';
    const params = [];
    if (qq) params.push('q='+encodeURIComponent(qq));
    if (cc) params.push('category='+cc);
    if (params.length) url += '?' + params.join('&');
    apiGet(url).then(setVideos).catch(()=>{}).finally(() => setLoading(false));
  };

  const search = (e) => { e.preventDefault(); load(q, category); };

  return (
    <div>
      <section className="text-center py-10 bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 dark:from-gray-700 dark:via-gray-800 dark:to-gray-900 mb-6">
        <h1 className="text-4xl font-extrabold text-[var(--accent-color)]">ReelsUp</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">Откройте новые ролики каждый день</p>
      </section>
      <form onSubmit={search} className="text-center mb-6">
        <input placeholder="Поиск..." value={q} onChange={e=>setQ(e.target.value)} />
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{ marginLeft: 6 }}>
          <option value="">Все категории</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button style={{ marginLeft: 6 }}>Найти</button>
      </form>
      <div className="feed">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <VideoCardSkeleton key={i} />)
          : videos.map(v => <VideoCard key={v.id} video={v} />)}
      </div>
    </div>
  );
}
