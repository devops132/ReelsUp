
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { IconDots, IconMoon, IconSun, IconUser, IconUpload, IconShield } from './Icons';

export default function NavBar({ darkMode, toggleTheme }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const onClick = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return (
    <div className="navbar">
      <div className="brand">
        <Link to="/">
          <img src="/logo.svg" alt="ReelsUp" onError={(e)=>{e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='inline';}} />
          <span className="brand-text">ReelsUp</span>
        </Link>
      </div>
      <form onSubmit={(e)=>{e.preventDefault(); nav(`/?q=${encodeURIComponent(q)}`);}} style={{ flex:1, maxWidth:600, margin:'0 12px', display:'flex' }}>
        <input placeholder="Поиск..." value={q} onChange={e=>setQ(e.target.value)} style={{ flex:1 }} />
        <button type="submit" style={{ marginLeft:6 }}>Найти</button>
      </form>
      <div className="links" style={{ display:'flex', alignItems:'center', gap:8 }}>
        <button onClick={toggleTheme} data-tooltip="Переключить тему" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36, borderRadius:8 }}>
          {darkMode ? <IconSun /> : <IconMoon />}
        </button>
        {user ? (<>
          <Link to="/upload" data-tooltip="Загрузить" style={{ display:'inline-flex', alignItems:'center', gap:6 }}><IconUpload /> Загрузить</Link>
          <Link to="/profile" data-tooltip="Профиль" style={{ display:'inline-flex', alignItems:'center', gap:6 }}><IconUser /> Профиль</Link>
          {user.role === 'admin' && <Link to="/admin" data-tooltip="Админ" style={{ display:'inline-flex', alignItems:'center', gap:6 }}><IconShield /> Админ</Link>}
          <div style={{ position:'relative' }} ref={menuRef}>
            <button title={user.name || user.email} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 8px', borderRadius:9999 }} onClick={()=>setOpen(!open)}>
              <img src={`https://www.gravatar.com/avatar/${(user.email||'').trim().toLowerCase()}`} alt="avatar" onError={(e)=>{e.currentTarget.style.display='none'}} style={{ width:24, height:24, borderRadius:'50%' }} />
              <IconDots />
            </button>
            <div className={"dropdown" + (open ? " open" : "")} style={{ position:'absolute', right:0, top:'110%', background:'var(--surface-1)', border:'1px solid var(--border-color)', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,.35)', padding:8, minWidth:160, transformOrigin:'top right', transition:'opacity .15s ease, transform .15s ease', opacity: open ? 1 : 0, transform: open ? 'scale(1)' : 'scale(0.96)', pointerEvents: open ? 'auto' : 'none' }}>
              <div style={{ padding:'6px 8px', color:'var(--text-muted)' }}>{user.email}</div>
              <Link to="/profile" onClick={()=>setOpen(false)} className="dropdown-item" style={{ display:'block', padding:'6px 8px' }}>Мой профиль</Link>
              <a href="#" onClick={(e)=>{e.preventDefault(); setOpen(false); logout(); nav('/');}} className="dropdown-item" style={{ display:'block', padding:'6px 8px' }}>Выход</a>
            </div>
          </div>
        </>) : (<>
          <Link to="/login">Вход</Link>
          <Link to="/register">Регистрация</Link>
        </>)}
      </div>
    </div>
  );
}
