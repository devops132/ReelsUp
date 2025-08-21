import axios from 'axios';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function Admin() {
  const [videos, setVideos] = useState<any[]>([]);
  useEffect(()=>{ fetchList(); }, []);
  async function fetchList(){
    const token = localStorage.getItem('token') || '';
    const r = await axios.get(`${API}/admin/videos`, { headers: { Authorization: `Bearer ${token}` } });
    setVideos(r.data);
  }
  async function changeStatus(id:string, status:string) {
    const token = localStorage.getItem('token') || '';
    await axios.patch(`${API}/admin/videos/${id}/status`, { status }, { headers: { Authorization: `Bearer ${token}` } });
    fetchList();
  }
  return (
    <main className='max-w-4xl mx-auto p-6'>
      <h1 className='text-2xl font-bold mb-4'>Админ — Модерация видео</h1>
      <table className='w-full bg-white rounded shadow'>
        <thead><tr className='text-left'><th>Видео</th><th>Автор</th><th>Действия</th></tr></thead>
        <tbody>
          {videos.map(v=> (
            <tr key={v.id} className='border-t'>
              <td className='p-3'>{v.title}</td>
              <td className='p-3'>{v.author_name}</td>
              <td className='p-3 space-x-2'>
                <button onClick={()=>changeStatus(v.id,'approved')} className='bg-primary text-white px-3 py-1 rounded'>Одобрить</button>
                <button onClick={()=>changeStatus(v.id,'rejected')} className='bg-red-400 text-white px-3 py-1 rounded'>Отклонить</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
