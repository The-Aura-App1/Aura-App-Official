import React, { useEffect, useId, useRef, useState } from 'react';
import { withGpt } from './gpt';
import { FEED_UNIT, ADS_TEST } from './adsConfig';

// A sponsored card in the feed: the post card's look, a "Sponsored" label,
// and one Google Ad Manager slot. It's matched only to the topics of the post
// above it (contextual, never personal). If no ad fills it, it disappears.
export default function FeedAd({ topics = [] }) {
  const id = `ad-${useId().replace(/:/g, '')}`;
  const slotRef = useRef(null);
  const [state, setState] = useState('loading');   // loading | shown | empty

  useEffect(() => {
    let cancelled = false;
    withGpt(googletag => {
      if (cancelled || !document.getElementById(id)) return;
      const slot = googletag.defineSlot(FEED_UNIT, [[300, 250], [336, 280], 'fluid'], id);
      if (!slot) { setState('empty'); return; }
      slot.addService(googletag.pubads());
      if (topics.length) slot.setTargeting('topic', topics.slice(0, 3));
      slotRef.current = slot;
      googletag.pubads().addEventListener('slotRenderEnded', e => {
        if (e.slot === slot && !cancelled) setState(e.isEmpty ? 'empty' : 'shown');
      });
      googletag.display(id);
    }).catch(() => { if (!cancelled) setState('empty'); });
    return () => {
      cancelled = true;
      const slot = slotRef.current;
      if (slot) window.googletag?.cmd.push(() => window.googletag.destroySlots([slot]));
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === 'empty') return null;
  return (
    <aside className="card p-0 overflow-hidden" aria-label="Sponsored">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Sponsored{ADS_TEST ? ' · Test ad' : ''}</span>
        <span className="text-[11px] text-[var(--text-muted)]">Not personalized</span>
      </div>
      <div className="flex justify-center px-4 pb-4 min-h-[250px]">
        <div id={id} className="w-full flex justify-center" />
      </div>
    </aside>
  );
}
