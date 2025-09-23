
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function NavBar({ darkMode, toggleTheme }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
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
      <div className="links">
        <button onClick={toggleTheme} title="Переключить тему">{darkMode ? '☀️' : '🌙'}</button>
        {user ? (<>
          <Link to="/upload">Загрузить</Link>
          <Link to="/profile">Профиль</Link>
          {user.role === 'admin' && <Link to="/admin">Админ</Link>}
          <a href="#" onClick={(e)=>{e.preventDefault(); logout(); nav('/');}}>Выход</a>
        </>) : (<>
          <Link to="/login">Вход</Link>
          <Link to="/register">Регистрация</Link>
        </>)}
      </div>
    </div>
  );
}
