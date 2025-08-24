import axios from 'axios';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ReelsPage() {
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    axios.get(`${API}/videos`).then(r => setVideos(r.data)).catch(console.error);
  }, []);

  return (
    <main className="h-screen snap-y snap-mandatory overflow-y-scroll">
      {videos.map(v => (
        <section key={v.id} className="snap-start h-screen w-screen relative flex items-center justify-center bg-black">
          <video src={v.video_url} poster={v.thumbnail || undefined} controls={false} autoPlay muted loop className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute bottom-6 left-4 text-white">
            <div className="font-semibold">{v.title}</div>
            <div className="text-sm opacity-80">{v.author_name}</div>
          </div>
          <div className="absolute right-4 bottom-6 flex flex-col items-center space-y-4 text-white">
            <button className="bg-black bg-opacity-50 rounded-full p-2">❤</button>
            <button className="bg-black bg-opacity-50 rounded-full p-2">💬</button>
            <button className="bg-black bg-opacity-50 rounded-full p-2">↗</button>
          </div>
        </section>
      ))}
    </main>
  );
}
