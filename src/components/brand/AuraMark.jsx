import React from 'react';

// Aura's own mark for aura the currency: the logo's tilted halo with a small
// glint where the light catches it. Drop-in for an icon (size, className,
// strokeWidth, aria-hidden), drawn in currentColor so it takes the text color.
export default function AuraMark({ size = 16, className = '', strokeWidth = 2, title, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={`aura-mark ${className}`}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} {...rest}>
      {/* the halo, tilted like the logo's */}
      <ellipse cx="11" cy="14.5" rx="9.6" ry="5.2" transform="rotate(-16 11 14.5)" />
      {/* its inner rim, so it reads as a ring of light rather than a flat oval */}
      <ellipse cx="11" cy="14.2" rx="5.6" ry="2.3" transform="rotate(-16 11 14.2)" strokeOpacity="0.45" strokeWidth={strokeWidth * 0.7} />
      {/* the glint: a small four-point twinkle where the light catches the ring */}
      <path d="M19 1.8 Q19.5 4.5 22.2 5 Q19.5 5.5 19 8.2 Q18.5 5.5 15.8 5 Q18.5 4.5 19 1.8 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
