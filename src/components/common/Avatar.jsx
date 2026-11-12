import React, { useState } from 'react';

const MEDIA_URL = 'https://aura-app-media-570934198135.s3.amazonaws.com/';

// A round profile picture, or the name's first letter when there isn't one
// (or it fails to load).
export default function Avatar({ name, picKey, size = 'w-8 h-8' }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`${size} rounded-full bg-aura-500/20 border border-aura-500/30 overflow-hidden flex-shrink-0 flex items-center justify-center`}>
      {picKey && !broken
        ? <img src={MEDIA_URL + picKey} alt="" className="w-full h-full object-cover" onError={() => setBroken(true)} />
        : <span className="text-aura-400 text-xs font-bold">{(name || '?')[0].toUpperCase()}</span>}
    </div>
  );
}
