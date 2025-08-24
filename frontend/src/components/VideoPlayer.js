
import React from 'react';
export default function VideoPlayer({ src }) {
  return <video src={src} controls style={{ maxWidth: '100%', width: '720px', display: 'block', margin: '0 auto' }} />;
}
