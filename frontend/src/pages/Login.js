
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  if (user) nav('/');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const ok = await login(email, password);
    if (!ok) setErr('Неверные учетные данные');
    else nav('/');
  };

  return (
    <form onSubmit={submit} className="form">
      <h2>Вход</h2>
      {err && <p style={{color:'red'}}>{err}</p>}
      <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label>Пароль<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      <button>Войти</button>
    </form>
  );
}
