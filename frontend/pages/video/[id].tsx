import axios from 'axios';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function VideoPage() {
  const router = useRouter();
  const { id } = router.query;
  const [video, setVideo] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [rating, setRating] = useState(5);

  useEffect(() => {
    if (!id) return;
    axios.get(`${API}/videos/${id}`).then(r => setVideo(r.data)).catch(console.error);
    axios.get(`${API}/comments/video/${id}`).then(r => setComments(r.data)).catch(console.error);
  }, [id]);

  async function postComment(e:any) {
    e.preventDefault();
    const token = localStorage.getItem('token') || '';
    await axios.post(`${API}/comments/video/${id}`, { text }, { headers: { Authorization: `Bearer ${token}` } });
    const r = await axios.get(`${API}/comments/video/${id}`);
    setComments(r.data);
    setText('');
  }

  async function postRating(e:any) {
    e.preventDefault();
    const token = localStorage.getItem('token') || '';
    const r = await axios.post(`${API}/ratings/${id}`, { value: rating }, { headers: { Authorization: `Bearer ${token}` } });
    alert('Средний рейтинг: ' + r.data.average);
  }

  if (!video) return <main className='p-6'>Загрузка...</main>;

  return (
    <main className='max-w-3xl mx-auto p-6'>
      <h1 className='text-2xl font-bold mb-4'>{video.title}</h1>
      <div className='mb-4'>
        <video src={video.video_url} controls className='w-full rounded-lg' poster={video.thumbnail || undefined} />
      </div>
      <p className='text-gray-700 mb-2'>{video.description}</p>
      <div className='mb-4'>
        <form onSubmit={postRating} className='flex items-center space-x-2'>
          <label>Оценить:</label>
          <input type='number' min={1} max={7} value={rating} onChange={e=>setRating(Number(e.target.value))} className='border p-1 rounded w-20' />
          <button className='bg-primary text-white px-4 py-2 rounded'>Отправить</button>
        </form>
      </div>
      <section className='mb-6'>
        <h2 className='text-lg font-semibold'>Комментарии</h2>
        <form onSubmit={postComment} className='mt-2'>
          <textarea className='w-full border p-2 rounded' value={text} onChange={e=>setText(e.target.value)} />
          <button className='mt-2 bg-primary text-white px-4 py-2 rounded'>Добавить</button>
        </form>
        <ul className='mt-4 space-y-3'>
          {comments.map(c => (
            <li key={c.id} className='bg-white p-3 rounded shadow'>
              <div className='text-sm text-gray-600'>{c.author_name}</div>
              <div>{c.text}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
