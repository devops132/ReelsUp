import axios from 'axios';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function Upload() {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<any>(null);
  const [message, setMessage] = useState('');

  async function handleUpload(e:any) {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('video', file);
      const token = localStorage.getItem('token') || '';
      const { data } = await axios.post(`${API}/videos`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setMessage('Загружено');
      window.location.href = '/';
    } catch (e:any) {
      setMessage(e.response?.data?.error || 'Ошибка загрузки');
    }
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Загрузка видео</h1>
      <form onSubmit={handleUpload} className="space-y-3 bg-white p-4 rounded-xl shadow">
        <input className="w-full border p-2 rounded" placeholder="Заголовок" value={title} onChange={e=>setTitle(e.target.value)} />
        <input type="file" accept="video/*" onChange={e=>setFile(e.target.files?.[0])} />
        <button className="w-full bg-primary text-white py-2 rounded">Загрузить</button>
        {message && <p className="text-sm text-gray-600">{message}</p>}
      </form>
    </main>
  )
}
