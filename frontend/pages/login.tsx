import axios from 'axios';
import { useState } from 'react';

// Используем /api по умолчанию, чтобы фронтенд работал через gateway
const API = process.env.NEXT_PUBLIC_API_BASE || '/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function handleLogin(e:any) {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API}/auth/login`, { email, password });
      localStorage.setItem('token', data.token);
      setMessage('Успешный вход');
      window.location.href = '/';
    } catch (e:any) {
      setMessage(e.response?.data?.error || 'Ошибка');
    }
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Вход</h1>
      <form onSubmit={handleLogin} className="space-y-3 bg-white p-4 rounded-xl shadow">
        <input className="w-full border p-2 rounded" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" className="w-full border p-2 rounded" placeholder="Пароль" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full bg-primary text-white py-2 rounded">Войти</button>
        {message && <p className="text-sm text-gray-600">{message}</p>}
      </form>
    </main>
  )
}
