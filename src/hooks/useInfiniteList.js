import { useState, useEffect, useRef, useCallback } from 'react';

// Pages through a cursor-based list, loading the next page when the sentinel
// element scrolls into view. fetchPage(cursor) must resolve to { items, nextCursor }.
export default function useInfiniteList(fetchPage) {
  const [items, setItems]           = useState([]);
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
      const page = await fetchPage(nextCursor);
      setItems(prev => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
      if (!page.nextCursor) setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchPage, loading, done, nextCursor]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || error) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '400px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, error]);

  return { items, setItems, loading, error, setError, done, loadMore, sentinelRef };
}
