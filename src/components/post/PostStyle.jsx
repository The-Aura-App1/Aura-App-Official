import React, { useEffect } from 'react';
import { textCardStyle, captionStyle, frameStyle, loadPostFont } from '../../utils/postStyle';
import PostOverlays from './PostOverlays';

// How a post's `style` shows up. PostCard and the composer's live preview
// both render through these, so what you design is what people see.

export function usePostFont(style) {
  const font = style?.font;
  useEffect(() => { if (font) loadPostFont(font); }, [font]);
}

// The body of a text post: a designed card when it has a background, plain
// text in the chosen font/color/size otherwise
export function TextBody({ text, style, groupBg = null, overlays = null, className = '' }) {
  usePostFont(style);
  const css = textCardStyle(style, text.length, groupBg);
  if (style?.bg) {
    // A text post with a background wears its frame on the card itself (the
    // part people look at), not on the outer post card around it
    const frame = frameProps(style);
    return (
      <div className={`relative mx-4 mb-1 rounded-xl px-6 py-8 min-h-[13rem] flex flex-col justify-center overflow-hidden ${frame.className} ${className}`}
        style={{ ...css, ...frame.style }} data-framed={frame.className ? '' : undefined}>
        <p className="whitespace-pre-wrap break-words leading-snug" style={{ textShadow: '0 1px 2px rgba(0,0,0,.12)' }}>{text}</p>
        {overlays?.length > 0 && <PostOverlays overlays={overlays} slide={0} />}
      </div>
    );
  }
  return (
    <div className={`px-4 py-3 ${className}`}>
      <p className="text-[var(--text-primary)] text-sm leading-relaxed whitespace-pre-wrap break-words" style={css ?? undefined}>{text}</p>
    </div>
  );
}

// A photo/video caption's text in the chosen font and color
export function CaptionText({ text, style }) {
  usePostFont(style);
  return <span style={captionStyle(style) ?? undefined}>{text}</span>;
}

// Props for the card around a post with a frame. With postType, a text post
// that has a background gets none here, because TextBody frames its card.
export function frameProps(style, postType) {
  const css = postType === 'text' && style?.bg ? null : frameStyle(style);
  if (!css) return { className: '', style: undefined };
  return { className: `post-frame${css['--frame-glow'] ? ' post-frame-glow' : ''}`, style: css };
}
