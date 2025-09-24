
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const { user, register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isBusiness, setIsBusiness] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (user) nav('/');
  }, [user, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const ok = await register(email, password, name, isBusiness);
    if (!ok) setErr('Не удалось зарегистрироваться');
    else nav('/');
  };

  return (
    <form onSubmit={submit} className="form">
      <h2>Регистрация</h2>
      {err && <p style={{color:'red'}}>{err}</p>}
      <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label>Пароль<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      <label>Имя<input value={name} onChange={e=>setName(e.target.value)} /></label>
      <label><input type="checkbox" checked={isBusiness} onChange={e=>setIsBusiness(e.target.checked)} /> Я бизнес-пользователь</label>
      <button>Зарегистрироваться</button>
    </form>
  );
}
