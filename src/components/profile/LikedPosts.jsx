import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../api';
import PostCard from '../post/PostCard';
import LoadingSpinner from '../common/LoadingSpinner';

// The owner's Liked tab. Loads the next page when the bottom comes into view.
export default function LikedPosts() {
  const [posts, setPosts]           = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [done, setDone]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const sentinelRef = useRef(null);

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getLikedPosts(nextCursor);
      setPosts(prev => [...prev, ...(data.posts ?? [])]);
      setNextCursor(data.nextCursor);
      if (!data.nextCursor) setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loading, done, nextCursor]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || error) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '400px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, error]);

  return (
    <div className="flex flex-col gap-4">
      {posts.map(post => <PostCard key={post.postId} post={post} />)}

      {done && posts.length === 0 && (
        <p className="text-center text-[var(--text-muted)] text-sm py-10">
          Posts you like will appear here.
        </p>
      )}

      {error && (
        <div className="text-center py-4">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <button onClick={loadMore} className="btn-secondary text-sm px-4 py-2">Try again</button>
        </div>
      )}

      {loading && <LoadingSpinner size={48} />}
      {!done && <div ref={sentinelRef} aria-hidden="true" />}
    </div>
  );
}
