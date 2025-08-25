import React from 'react';

export default function VideoCardSkeleton() {
  return (
    <div className="video-card animate-pulse">
      <div className="thumb-wrap bg-gray-300 dark:bg-gray-700" />
      <div className="content p-3 space-y-2">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2" />
      </div>
    </div>
  );
}
