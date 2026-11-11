import React, { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';

// The like heart. Liking pops it with a ring that spreads out like a halo.
export default function LikeHeart({ liked, size = 20 }) {
  const prev = useRef(liked);
  const [pops, setPops] = useState(0);
  useEffect(() => {
    if (liked && !prev.current) setPops(n => n + 1);
    prev.current = liked;
  }, [liked]);

  return (
    <span key={pops} className={`relative inline-flex ${pops && liked ? 'aura-like-pop' : ''}`}>
      <Heart size={size} fill={liked ? 'currentColor' : 'none'} />
      {pops > 0 && liked && <span className="aura-like-ring" aria-hidden="true" />}
    </span>
  );
}
