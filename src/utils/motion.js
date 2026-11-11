// True when the device asks for less motion. App animations then fade
// instead of moving (the scenery has its own rule, see SceneDecor).
export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
