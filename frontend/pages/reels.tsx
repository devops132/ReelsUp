import axios from 'axios';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ReelsPage() {
  const [videos, setVideos] = useState<any[]>([]);
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
