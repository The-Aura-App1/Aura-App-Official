// True when the device asks for less motion. App animations then fade
// instead of moving. Small feedback moments still play (see motion.css).
export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
