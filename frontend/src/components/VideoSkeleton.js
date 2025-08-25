import React from 'react';

export default function VideoSkeleton() {
  return (
    <div className="video-card animate-pulse">
      <div className="thumb-wrap bg-gray-300 dark:bg-gray-700"></div>
      <div className="content">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
      </div>
    </div>
  );
}

