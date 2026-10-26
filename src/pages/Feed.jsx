import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/post/PostCard';
import TuneFeed from '../components/feed/TuneFeed';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { loadPrefs, savePrefs, setTopics } from '../utils/feedPrefs';
import { rankFeed } from '../utils/feedRanking';

const PAGE_SIZE = 20;

export default function Feed() {
  const { user }  = useAuth();
  const userId    = user?.userId;
  const [posts, setPosts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [shown, setShown]     = useState(PAGE_SIZE);
  // prefs is what's saved; rankPrefs is what the visible order uses. Choices
  // from a post's menu wait until the next load so the feed doesn't jump.
  const [prefs, setPrefs]         = useState(() => loadPrefs(userId));
  const [rankPrefs, setRankPrefs] = useState(prefs);
  const prefsRef    = useRef(prefs);
  const sentinelRef = useRef(null);

  useEffect(() => {
    const saved = loadPrefs(userId);
    prefsRef.current = saved;
    setPrefs(saved);
    setRankPrefs(saved);
  }, [userId]);

  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getFeed();
      setPosts(data.posts ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const ranked = useMemo(() => rankFeed(posts, rankPrefs), [posts, rankPrefs]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setShown(n => n + PAGE_SIZE);
    }, { rootMargin: '600px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ranked, shown]);

  function storePrefs(update) {
    const next = update(prefsRef.current);
    prefsRef.current = next;
    savePrefs(userId, next);
    setPrefs(next);
    return next;
  }

  function changePrefs(update) {
    setRankPrefs(storePrefs(update));
    setShown(PAGE_SIZE);
  }

  function preferPost(post, choice) {
    storePrefs(current => setTopics(current, post.tags ?? [], choice));
  }

  if (loading) return <LoadingSpinner />;
  if (error) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-red-400 text-sm">{error}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 pb-8">
      <TuneFeed prefs={prefs} onChange={changePrefs} />

      {!posts.length && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-[var(--text-primary)] font-semibold text-lg">No posts yet</p>
          <p className="text-[var(--text-muted)] text-sm text-center">Be the first to post something.</p>
        </div>
      )}

      {ranked.slice(0, shown).map(post => (
        <PostCard key={post.postId} post={post} onUpdate={loadFeed} onPrefer={preferPost} />
      ))}

      {shown < ranked.length && <div ref={sentinelRef} aria-hidden="true" />}
    </div>
  );
}
