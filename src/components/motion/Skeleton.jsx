import React from 'react';

// Loading placeholders with a soft shimmer in the theme's own colors.
export function Shimmer({ className = '' }) {
  return <div className={`aura-shimmer ${className}`} />;
}

export function PostSkeleton({ media = true }) {
  return (
    <div className="card p-0 overflow-hidden" aria-hidden="true">
      <div className="flex items-center gap-3 px-4 py-3">
        <Shimmer className="w-9 h-9 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Shimmer className="h-3 w-32 rounded-full" />
          <Shimmer className="h-2.5 w-16 rounded-full" />
        </div>
      </div>
      {media
        ? <Shimmer className="aspect-[4/3]" />
        : <div className="px-4 py-2 flex flex-col gap-2">
            <Shimmer className="h-3 w-full rounded-full" />
            <Shimmer className="h-3 w-4/5 rounded-full" />
          </div>}
      <div className="flex items-center gap-2 px-4 py-3">
        <Shimmer className="h-7 w-16 rounded-xl" />
        <Shimmer className="h-4 w-8 rounded-full" />
      </div>
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading posts">
      <PostSkeleton />
      <PostSkeleton media={false} />
      <PostSkeleton />
    </div>
  );
}

export function CommentSkeleton({ count = 3 }) {
  return (
    <div className="space-y-5" role="status" aria-label="Loading comments">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Shimmer className="w-8 h-8 rounded-full flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-2 pt-1">
            <Shimmer className="h-2.5 w-28 rounded-full" />
            <Shimmer className={`h-3 rounded-full ${i % 2 ? 'w-3/5' : 'w-11/12'}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
