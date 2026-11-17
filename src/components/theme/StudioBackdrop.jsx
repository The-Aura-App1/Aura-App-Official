import React, { useEffect, useState } from 'react';
import { mediaUrl } from '../../themes/studioMedia';

// The CSS background for a Studio gradient
export function gradientCss(b) {
  const stops = b.stops.join(', ');
  if (b.type === 'radial') return `radial-gradient(circle at 50% 30%, ${stops})`;
  if (b.type === 'conic') return `conic-gradient(from ${b.angle}deg at 50% 50%, ${stops}, ${b.stops[0]})`;
  return `linear-gradient(${b.angle}deg, ${stops})`;
}

// A Theme Studio backdrop: a gradient, or the person's own picture, GIF or
// video (kept on this device), dimmed and blurred as they set it. Scenes and
// the plain glow are drawn by AppShell like any other theme's.
// `still` stops a video (scenery switched off).
export default function StudioBackdrop({ backdrop, still = false, className = '' }) {
  const [url, setUrl] = useState(null);
  const media = backdrop?.kind === 'image' || backdrop?.kind === 'video';
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (media) mediaUrl(backdrop.mediaId).then(u => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [media, backdrop?.mediaId]);

  if (!backdrop) return null;
  const filter = backdrop.blur ? { filter: `blur(${backdrop.blur}px)`, transform: 'scale(1.06)' } : undefined;
  return (
    <div aria-hidden="true" className={`studio-backdrop ${className}`} data-backdrop={backdrop.kind}>
      {backdrop.kind === 'gradient' && (
        <div className={`absolute inset-0 ${backdrop.animate && !still ? 'studio-drift' : ''}`}
          style={{ background: gradientCss(backdrop), backgroundSize: backdrop.animate && !still ? '160% 160%' : undefined, ...filter }} />
      )}
      {backdrop.kind === 'image' && url && <img src={url} alt="" style={filter} />}
      {backdrop.kind === 'video' && url && (
        <video src={url} autoPlay={!still} muted loop playsInline style={filter}
          ref={v => { if (v) { if (still) v.pause(); else v.play?.().catch(() => {}); } }} />
      )}
      {(media || backdrop.kind === 'gradient') && backdrop.dim > 0 && (
        <div className="absolute inset-0" style={{ background: `rgba(0, 0, 0, ${backdrop.dim})` }} />
      )}
    </div>
  );
}
