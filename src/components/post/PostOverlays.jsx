import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Link2, AtSign, Hash } from 'lucide-react';
import { domainOf, inkOn } from '../../utils/overlays';
import { fontFamily, loadPostFont } from '../../utils/postStyle';

// One placed item, drawn the same in the feed and in the editor. Sizes are in
// container units (cqw), so it scales with the post. `interactive` makes
// links, mentions and hashtags tappable (never in the editor).
export function OverlayItem({ o, interactive = false }) {
  const size = o.size ?? 1;
  useEffect(() => { if (o.font) loadPostFont(o.font); }, [o.font]);
  const base = { fontSize: `${4.4 * size}cqw`, lineHeight: 1.15, ...(o.font && { fontFamily: fontFamily(o.font) }) };
  const pill = 'inline-flex items-center gap-[0.3em] rounded-[0.6em] px-[0.6em] py-[0.3em] font-semibold whitespace-nowrap shadow-lg';
  const stop = e => e.stopPropagation();
  if (o.kind === 'text') {
    const solid = o.bg === 'solid', soft = o.bg === 'soft';
    return (
      <span className={`inline-block max-w-[85cqw] text-center font-bold whitespace-pre-wrap break-words ${solid || soft ? 'rounded-[0.4em] px-[0.45em] py-[0.15em]' : ''}`}
        style={{ ...base, color: solid ? inkOn(o.color) : o.color, background: solid ? o.color : soft ? 'rgba(0,0,0,.55)' : 'transparent',
          textShadow: solid ? 'none' : '0 1px 3px rgba(0,0,0,.6), 0 0 1px rgba(0,0,0,.8)' }}>
        {o.text}
      </span>
    );
  }
  if (o.kind === 'emoji') return <span style={{ fontSize: `${9 * size}cqw`, lineHeight: 1 }} aria-label="emoji">{o.emoji}</span>;
  const look = { ...base, background: '#ffffff', color: o.color === '#ffffff' ? '#7c3aed' : o.color };
  if (o.kind === 'link') {
    const content = <><Link2 style={{ width: '1em', height: '1em' }} aria-hidden="true" />{o.label || domainOf(o.url)}</>;
    return interactive
      ? <a href={o.url} target="_blank" rel="noopener noreferrer nofollow ugc" onClick={stop} className={pill} style={look} title={o.url}>{content}</a>
      : <span className={pill} style={look}>{content}</span>;
  }
  if (o.kind === 'mention') {
    const content = <><AtSign style={{ width: '1em', height: '1em' }} aria-hidden="true" />{o.username}</>;
    return interactive
      ? <Link to={`/profile/${encodeURIComponent(o.username)}`} onClick={stop} className={pill} style={look}>{content}</Link>
      : <span className={pill} style={look}>{content}</span>;
  }
  if (o.kind === 'hashtag') {
    const content = <><Hash style={{ width: '1em', height: '1em' }} aria-hidden="true" />{o.tag}</>;
    return interactive
      ? <Link to={`/search?q=${encodeURIComponent(`#${o.tag}`)}`} onClick={stop} className={pill} style={look}>{content}</Link>
      : <span className={pill} style={look}>{content}</span>;
  }
  return null;
}

// Everything placed on one slide of a post, positioned over its media box
export default function PostOverlays({ overlays = [], slide = 0 }) {
  const here = overlays.filter(o => (o.slide ?? 0) === slide);
  if (!here.length) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ containerType: 'inline-size' }}>
      {here.map((o, i) => (
        <div key={i} className="absolute pointer-events-auto" style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%`, transform: 'translate(-50%, -50%)' }}>
          <OverlayItem o={o} interactive />
        </div>
      ))}
    </div>
  );
}
