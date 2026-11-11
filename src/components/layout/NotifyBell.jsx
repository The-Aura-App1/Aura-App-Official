import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

// The notifications bell. It sways once, and the badge pops, whenever the
// unread count goes up.
export default function NotifyBell({ count = 0, size = 20 }) {
  const prev = useRef(count);
  const [rings, setRings] = useState(0);
  useEffect(() => {
    if (count > prev.current) setRings(n => n + 1);
    prev.current = count;
  }, [count]);

  return (
    <span className="relative inline-flex">
      <span key={rings} className={`inline-flex ${rings ? 'aura-bell-ring' : ''}`}><Bell size={size} /></span>
      {count > 0 && (
        <span key={`badge-${rings}`}
          className="aura-badge-pop absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full aura-fill
                     text-white text-[9px] font-bold flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </span>
  );
}
