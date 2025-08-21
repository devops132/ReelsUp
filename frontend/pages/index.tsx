import axios from 'axios';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function Home() {
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    axios.get(`${API}/videos`).then(r => setVideos(r.data)).catch(console.error);
  }, []);

  return (
    <main className="max-w-4xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-primary">ReelsUP</h1>
        <nav className="space-x-4">
          <a href="/login">Войти</a>
          <a className="bg-primary text-white px-4 py-2 rounded-lg" href="/register">Регистрация</a>
          <a className="bg-accent text-white px-4 py-2 rounded-lg" href="/upload">Загрузить</a>
          <a className="bg-gray-200 text-black px-4 py-2 rounded-lg" href="/admin">Admin</a>
        </nav>
      </header>

      <h2 className="text-xl font-semibold mb-4">Лента видео</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {videos.map(v => (
          <div key={v.id} className="bg-white rounded-xl p-3 shadow">
            <Link href={`/video/${v.id}`}>
              <a>
                <img src={v.thumbnail || '/placeholder.png'} className="w-full rounded-lg object-cover h-48" />
                <div className="mt-2">
                  <div className="font-semibold">{v.title}</div>
                  <div className="text-sm text-gray-500">{v.author_name}</div>
                </div>
              </a>
            </Link>
          </div>
        ))}
      </div>
    </main>
  )
}