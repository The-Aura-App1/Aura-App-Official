import React, { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';

const DOTS = 7;

// The like heart. Liking pops it with a halo ring and a small burst of dots.
export default function LikeHeart({ liked, size = 20 }) {
  const prev = useRef(liked);
  const [pops, setPops] = useState(0);
  useEffect(() => {
    if (liked && !prev.current) setPops(n => n + 1);
    prev.current = liked;
  }, [liked]);
  const popping = pops > 0 && liked;

  return (
    <span key={pops} className={`relative inline-flex ${popping ? 'aura-like-pop' : ''}`}>
      <Heart size={size} fill={liked ? 'currentColor' : 'none'} />
      {popping && (
        <span aria-hidden="true" className="aura-like-fx" style={{ '--s': `${size}px` }}>
          <span className="aura-like-ring" />
          {Array.from({ length: DOTS }, (_, i) => (
            <span key={i} className="aura-like-dot" style={{ '--a': `${(i / DOTS) * 360 - 90}deg` }} />
          ))}
        </span>
      )}
    </span>
  );
}
