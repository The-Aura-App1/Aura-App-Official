import React, { useCallback } from 'react';
import { api } from '../../api';
import PostCard from '../post/PostCard';
import LoadingSpinner from '../common/LoadingSpinner';
import useInfiniteList from '../../hooks/useInfiniteList';

// A group's feed, newest first, loading more as you scroll
export default function GroupPosts({ groupId }) {
  const fetchPage = useCallback(async cursor => {
    const data = await api.getGroupPosts(groupId, cursor);
    return { items: data.posts ?? [], nextCursor: data.nextCursor };
  }, [groupId]);
  const { items: posts, setItems, loading, error, setError, done, loadMore, sentinelRef } = useInfiniteList(fetchPage);

  async function removePost(post) {
    try {
      await api.deletePost(post.postId);
      setItems(prev => prev.filter(p => p.postId !== post.postId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map(post => (
        <PostCard key={post.postId} post={post} onRemove={post.canRemove ? removePost : undefined} />
      ))}

      {done && posts.length === 0 && (
        <p className="text-center text-[var(--text-muted)] text-sm py-10">No posts yet. Start the conversation!</p>
      )}

      {error && (
        <div className="text-center py-4">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <button onClick={loadMore} className="btn-secondary text-sm px-4 py-2 text-[var(--text-primary)]">Try again</button>
        </div>
      )}

      {loading && <LoadingSpinner size={48} />}
      {!done && <div ref={sentinelRef} aria-hidden="true" />}
    </div>
  );
}
