import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import PostCard from '../components/post/PostCard';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function Feed() {
  const [posts, setPosts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getFeed(20);
      setPosts(data.posts ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  if (loading) return <LoadingSpinner />;
  if (error) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-red-400 text-sm">{error}</p>
    </div>
  );

  if (!posts.length) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="text-[var(--text-primary)] font-semibold text-lg">No posts yet</p>
      <p className="text-[var(--text-muted)] text-sm text-center">Be the first to post something.</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 pb-8">
      {posts.map(post => (
        <PostCard key={post.postId} post={post} onUpdate={loadFeed} />
      ))}
    </div>
  );
}