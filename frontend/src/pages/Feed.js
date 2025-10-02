
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiGet } from '../api';
import VideoCard from '../components/VideoCard';
import VideoSkeleton from '../components/VideoSkeleton';
import LiveStreamsBlock from '../components/LiveStreamsBlock';
import LeftSidebar from '../components/LeftSidebar';

export default function Feed() {
  const location = useLocation();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [selectedCats, setSelectedCats] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sort, setSort] = useState('new');

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const qq = sp.get('q') || '';
    const cc = sp.get('category') || '';
    const tg = sp.get('tag') || '';
    const catsCsv = sp.get('categories') || '';
    const tagsCsv = sp.get('tags') || '';
    const cats = catsCsv ? catsCsv.split(',').map(x=>x.trim()).filter(Boolean) : (cc ? [cc] : []);
    const tags = tagsCsv ? tagsCsv.split(',').map(x=>x.trim()).filter(Boolean) : (tg ? [tg] : []);
    setQ(qq || tg);
    setCategory(cc);
    setSelectedCats(cats);
    setSelectedTags(tags);
    load({ q: (qq||tg), category: cc, categories: cats, tags });
    fetch('/api/categories').then(r=>r.json()).then(setCategories).catch(()=>{});
  }, [location.search]);

  const load = ({ q:qq='', category:cc='', categories:catsArr=[], tags:tagsArr=[], sortBy=sort }={}) => {
    setLoading(true);
    let url = '/api/videos';
    const params = [];
    if (qq) params.push('q='+encodeURIComponent(qq));
    if (cc) params.push('category='+cc);
    if (catsArr.length) params.push('categories='+catsArr.join(','));
    if (tagsArr.length) params.push('tags='+encodeURIComponent(tagsArr.join(',')));
    if (sortBy === 'likes') params.push('sort=likes');
    // exclude reels from main feed (handled on client if backend doesn't support filtering)
    if (params.length) url += '?' + params.join('&');
    apiGet(url)
      .then(data => {
        const nonReels = (data || []).filter(v => !(v.reel === 1 || v.reel === true || v.is_reel === 1 || v.is_reel === true));
        setVideos(nonReels);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const search = (e) => {
    e.preventDefault();
    const tokens = (q || '').split(/[\s,]+/).filter(Boolean).map(t => t.startsWith('#') ? t : ('#'+t));
    const uniq = Array.from(new Set([...selectedTags, ...tokens])).slice(0,20);
    setSelectedTags(uniq);
    const sp = new URLSearchParams(location.search);
    if (uniq.length) sp.set('tags', uniq.join(',')); else sp.delete('tags');
    window.history.replaceState(null, '', `/?${sp.toString()}`);
    load({ q, category, categories:selectedCats, tags:uniq });
  };

  const addFilterCat = (id) => {
    if (selectedCats.includes(String(id))) return;
    const next = [...selectedCats, String(id)].slice(0,20);
    setSelectedCats(next);
    const sp = new URLSearchParams(location.search);
    sp.set('categories', next.join(','));
    window.history.replaceState(null, '', `/?${sp.toString()}`);
    load({ q, category, categories:next, tags:selectedTags });
  };

  const addFilterTag = (tag) => {
    const t = tag.startsWith('#') ? tag : ('#'+tag);
    if (selectedTags.includes(t)) return;
    const next = [...selectedTags, t].slice(0,20);
    setSelectedTags(next);
    const sp = new URLSearchParams(location.search);
    sp.set('tags', next.join(','));
    window.history.replaceState(null, '', `/?${sp.toString()}`);
    load({ q, category, categories:selectedCats, tags:next });
  };

  const removeFilterCat = (id) => {
    const next = selectedCats.filter(x => x !== String(id));
    setSelectedCats(next);
    const sp = new URLSearchParams(location.search);
    if (next.length) sp.set('categories', next.join(',')); else sp.delete('categories');
    // also clear single category param if conflicting
    if (sp.get('category') && !next.includes(sp.get('category'))) sp.delete('category');
    window.history.replaceState(null, '', `/?${sp.toString()}`);
    load({ q, category, categories:next, tags:selectedTags });
  };

  const removeFilterTag = (tag) => {
    const t = tag.startsWith('#') ? tag : ('#'+tag);
    const next = selectedTags.filter(x => x !== t);
    setSelectedTags(next);
    const sp = new URLSearchParams(location.search);
    if (next.length) sp.set('tags', next.join(',')); else sp.delete('tags');
    window.history.replaceState(null, '', `/?${sp.toString()}`);
    load({ q, category, categories:selectedCats, tags:next });
  };

  const clearAllFilters = () => {
    setSelectedCats([]); setSelectedTags([]); setCategory('');
    const sp = new URLSearchParams(location.search);
    ['categories','tags','category','tag'].forEach(k => sp.delete(k));
    window.history.replaceState(null, '', `/?${sp.toString()}`);
    load({ q });
  };

  return (
    <div className="page-with-sidebar">
      <LeftSidebar />
      <div className="page-content">
        <h1 className="section-header">Лента ReelsUp</h1>
        <LiveStreamsBlock />
      <form onSubmit={search} className="feed-controls">
        <input placeholder="Поиск..." value={q} onChange={e=>setQ(e.target.value)} />
        <select value={category} onChange={e=>{ const val = e.target.value; setCategory(val); if (val) addFilterCat(val); }}>
          <option value="">Все категории</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.parent_id ? `${c.name} (${(categories.find(x=>x.id===c.parent_id)?.name)||'—'})` : c.name}</option>)}
        </select>
        <select value={sort} onChange={e=>{ const nextSort = e.target.value; setSort(nextSort); load({ q, category, categories:selectedCats, tags:selectedTags, sortBy: nextSort }); }}>
          <option value="new">Новые</option>
          <option value="likes">По лайкам</option>
        </select>
        <button>Найти</button>
      </form>
      {(selectedCats.length || selectedTags.length) ? (
        <div style={{ maxWidth: 1320, margin:'10px auto 0', padding:'0 16px' }}>
          <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:8 }}>
            {selectedCats.map(id => {
              const catObj = categories.find(c => String(c.id) === String(id));
              const name = catObj ? catObj.name : `Категория ${id}`;
              return (
                <button key={`c-${id}`} onClick={()=>removeFilterCat(id)} className="badge" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                  {name} <span style={{ opacity:.8 }}>✕</span>
                </button>
              );
            })}
            {selectedTags.map(t => (
              <button key={`t-${t}`} onClick={()=>removeFilterTag(t)} className="badge" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                {t} <span style={{ opacity:.8 }}>✕</span>
              </button>
            ))}
            <button onClick={clearAllFilters} className="badge" style={{ background:'var(--warn-color)', border:'none', color:'#fff' }}>Очистить все</button>
          </div>
        </div>
      ) : null}
        <div className="feed">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <VideoSkeleton key={i} />)
            : videos.map(v => <VideoCard key={v.id} video={v} />)}
        </div>
      </div>
    </div>
  );
}
