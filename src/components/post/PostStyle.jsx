import React, { useEffect } from 'react';
import { textCardStyle, captionStyle, frameStyle, loadPostFont } from '../../utils/postStyle';

// How a post's `style` shows up. PostCard and the composer's live preview
// both render through these, so what you design is what people see.

export function usePostFont(style) {
  const font = style?.font;
  useEffect(() => { if (font) loadPostFont(font); }, [font]);
}

// The body of a text post: a designed card when it has a background, plain
// text in the chosen font/color/size otherwise
export function TextBody({ text, style, className = '' }) {
  usePostFont(style);
  const css = textCardStyle(style, text.length);
  if (style?.bg) {
    return (
      <div className={`mx-4 mb-1 rounded-xl px-6 py-8 min-h-[13rem] flex flex-col justify-center ${className}`} style={css}>
        <p className="whitespace-pre-wrap break-words leading-snug" style={{ textShadow: '0 1px 2px rgba(0,0,0,.12)' }}>{text}</p>
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

// Props for the card around a post with a frame
export function frameProps(style) {
  const css = frameStyle(style);
  if (!css) return { className: '', style: undefined };
  return { className: `post-frame${css['--frame-glow'] ? ' post-frame-glow' : ''}`, style: css };
}
