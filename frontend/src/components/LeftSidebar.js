import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconHome, IconPhonePlay, IconCameraTripod } from './Icons';

export default function LeftSidebar() {
  const location = useLocation();
  const path = location.pathname || '/';
  const isActive = (p) => (p === '/' ? path === '/' : path.startsWith(p));
  return (
    <aside className="left-sidebar">
      <nav className="left-nav">
        <Link to="/" className={"left-nav-item" + (isActive('/') ? ' active' : '')}>
          <IconHome /> <span>Главная</span>
        </Link>
        <Link to="/shorts" className={"left-nav-item" + (isActive('/shorts') ? ' active' : '')}>
          <IconPhonePlay /> <span>Шортсы</span>
        </Link>
        <Link to="/go-live" className={"left-nav-item" + (isActive('/go-live') ? ' active' : '')}>
          <IconCameraTripod /> <span>Трансляция</span>
        </Link>
      </nav>
    </aside>
  );
}


