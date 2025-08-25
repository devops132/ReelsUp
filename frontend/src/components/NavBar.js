
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function NavBar({ darkMode, toggleTheme }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="navbar">
        <div className="brand"><Link to="/"><strong>ReelsUp</strong></Link></div>
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
