import axios from 'axios';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  async function handleRegister(e:any) {
    e.preventDefault();
    try {
      await axios.post(`${API}/auth/register`, { email, password, name });
      setMessage('Регистрация успешна, войдите');
      window.location.href = '/login';
    } catch (e:any) {
      setMessage(e.response?.data?.error || 'Ошибка');
    }
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Регистрация</h1>
      <form onSubmit={handleRegister} className="space-y-3 bg-white p-4 rounded-xl shadow">
        <input className="w-full border p-2 rounded" placeholder="Имя" value={name} onChange={e=>setName(e.target.value)} />
        <input className="w-full border p-2 rounded" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" className="w-full border p-2 rounded" placeholder="Пароль" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full bg-primary text-white py-2 rounded">Создать аккаунт</button>
        {message && <p className="text-sm text-gray-600">{message}</p>}
      </form>
    </main>
  )
}
