import { useEffect, useRef, useState } from 'react';

// Shared observer: an element gets revealed the first time it scrolls into view.
let observer = null;
const callbacks = new WeakMap();

function watch(el, onShow) {
  if (typeof IntersectionObserver === 'undefined') { onShow(); return () => {}; }
  if (!observer) {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        callbacks.get(entry.target)?.();
        callbacks.delete(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
  }
  callbacks.set(el, onShow);
  observer.observe(el);
  return () => { callbacks.delete(el); observer.unobserve(el); };
}

export default function useReveal() {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    return watch(el, () => setShown(true));
  }, []);
  return [ref, shown];
}
