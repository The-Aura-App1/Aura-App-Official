import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { getTheme, PUBLIC_ROTATION } from '../../themes';
import seeded from '../scenes/seeded';
import SnowyPeaks from '../scenes/SnowyPeaks';
import Duskfall from '../scenes/Duskfall';
import Meadow from '../scenes/Meadow';
import TwinklingStars from '../scenes/TwinklingStars';
import '../scenes/scenes.css';
import BrandWordmark from '../brand/Wordmark';

// Overlapping circles along a baseline. The SVG filter in FloatingCloud
// roughens their edges with noise, which turns the blobs into soft clouds.
function cloudPuffs(seed, { width, baseline, minR, maxR, step }) {
  const rand = seeded(seed);
  const puffs = [];
  for (let x = -maxR; x < width + maxR; x += step * (0.6 + rand() * 0.8)) {
    const r = minR + rand() * (maxR - minR);
    puffs.push({ cx: x, cy: baseline - rand() * r * 0.6, r });
  }
  return puffs;
}

// A single small cloud drifting high in the sky.
function FloatingCloud({ seed, className, style }) {
  const puffs = cloudPuffs(seed, { width: 260, baseline: 90, minR: 26, maxR: 52, step: 42 });
  return (
    <svg className={`absolute overflow-visible ${className}`} style={style} viewBox="0 0 260 150" aria-hidden="true">
      <defs>
        <linearGradient id={`float-fill-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="40%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f5dcd2" />
        </linearGradient>
        <filter id={`float-edge-${seed}`} x="-20%" y="-40%" width="140%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed={seed} />
          <feDisplacementMap in="SourceGraphic" scale="22" />
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
      <g filter={`url(#float-edge-${seed})`} fill={`url(#float-fill-${seed})`}>
        {puffs.filter(p => p.cx > 30 && p.cx < 230).map((p, j) => <circle key={j} cx={p.cx} cy={p.cy} r={p.r} />)}
        <ellipse cx="130" cy="95" rx="100" ry="22" />
      </g>
    </svg>
  );
}

// The logo on the public pages. `size` picks the big landing-page version
// or the compact one above the auth forms.
export function Wordmark({ size = 'lg', linked = false }) {
  const text = size === 'lg'
    ? <BrandWordmark className="text-6xl sm:text-8xl md:text-9xl" />
    : <BrandWordmark className="text-4xl sm:text-5xl" />;
  return linked ? <Link to="/welcome" aria-label="Aura App home">{text}</Link> : text;
}

// Pause/play for the rotating scenery, plus a dot per scene. Picking a dot
// jumps to that scene and stays there.
function SceneControls() {
  const scenes = useContext(SceneContext);
  if (!scenes) return null;
  const { index, paused, togglePaused, pick } = scenes;
  const current = getTheme(PUBLIC_ROTATION[index]);
  return (
    <div className="ml-1 flex items-center gap-0.5 h-9 pl-1 pr-1.5 rounded-xl bg-white/50 dark:bg-white/5 border border-white/80 dark:border-white/15">
      <button type="button" onClick={togglePaused}
        aria-label={paused ? 'Rotate the scenery' : `Keep the ${current.name} scenery`}
        title={paused ? 'Rotate the scenery' : `Keep ${current.name}`}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-aura-800 dark:text-aura-100 hover:text-aura-500 transition-colors">
        {paused ? <Play size={15} /> : <Pause size={15} />}
      </button>
      {PUBLIC_ROTATION.map((id, i) => {
        const theme = getTheme(id);
        return (
          <button key={id} type="button" onClick={() => pick(i)} aria-label={`Show ${theme.name}`} aria-pressed={i === index}
            title={theme.name} className="w-5 h-7 flex items-center justify-center group">
            <span className={`block rounded-full transition-all duration-300
              ${i === index ? 'w-2.5 h-2.5 bg-aura-500' : 'w-1.5 h-1.5 bg-aura-800/30 dark:bg-white/30 group-hover:bg-aura-500/70'}`} />
          </button>
        );
      })}
    </div>
  );
}

// Top bar for the public pages: logo home, About, Sign in and the scenery
// controls.
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-5 sm:px-10 py-6">
      <Link to="/welcome" aria-label="Aura App home">
        <img src="/aura-logo.png" alt="Aura App" className="w-9 h-9 rounded-xl" />
      </Link>
      <nav className="flex items-center gap-1 sm:gap-3 text-sm">
        <Link to="/about" className="px-3 py-2 rounded-xl text-aura-800 dark:text-aura-100 hover:text-aura-500 font-medium transition-colors">About</Link>
        <Link to="/signin" className="px-3 py-2 rounded-xl text-aura-800 dark:text-aura-100 hover:text-aura-500 font-medium transition-colors">Sign in</Link>
        <SceneControls />
      </nav>
    </header>
  );
}

// A soft crescent moon: a glowing disc with a second, offset disc masked out
// of it, tilted a little like a real waxing crescent.
function CrescentMoon({ className }) {
  return (
    <svg className={`aura-day-only aura-moon absolute ${className}`} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="moon-glow" cx="40%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#efe9ff" />
        </radialGradient>
        <mask id="moon-cut">
          <rect width="100" height="100" fill="white" />
          <circle cx="66" cy="40" r="35" fill="black" />
        </mask>
      </defs>
      <g transform="rotate(-18 50 50)">
        <circle cx="50" cy="50" r="40" fill="url(#moon-glow)" mask="url(#moon-cut)" />
      </g>
    </svg>
  );
}

// Wing positions for one flap, drawn as a filled silhouette (wing tips, body
// in the middle). Every frame uses the same commands, so the browser can
// morph smoothly between them.
const WINGS_UP   = 'M-12 -7 C-8 -4 -4 -1 0 1 C4 -1 8 -4 12 -7 C8 -2.5 4 0.5 0 3 C-4 0.5 -8 -2.5 -12 -7 Z';
const WINGS_MID  = 'M-12 0 C-8 -2 -4 -1 0 1 C4 -1 8 -2 12 0 C8 0.5 4 1.5 0 3 C-4 1.5 -8 0.5 -12 0 Z';
const WINGS_DOWN = 'M-11 5 C-8 1 -4 0 0 1 C4 0 8 1 11 5 C8 2.5 4 2 0 3 C-4 2 -8 2.5 -11 5 Z';
const FLAP = [WINGS_UP, WINGS_MID, WINGS_DOWN, WINGS_MID, WINGS_UP].join(';');

// A loose flock seen from far away: smaller, hazier birds read as further
// back. Each one flaps at its own speed and bobs a little on its own.
const BIRDS = [
  { x: 0,   y: 22, scale: 1,    flap: 0.62, begin: 0,    opacity: 0.85 },
  { x: 26,  y: 10, scale: 0.85, flap: 0.7,  begin: 0.2,  opacity: 0.75 },
  { x: 30,  y: 36, scale: 0.9,  flap: 0.58, begin: 0.35, opacity: 0.8  },
  { x: 54,  y: 2,  scale: 0.7,  flap: 0.75, begin: 0.1,  opacity: 0.6  },
  { x: 58,  y: 46, scale: 0.75, flap: 0.66, begin: 0.45, opacity: 0.65 },
  { x: 84,  y: 18, scale: 0.6,  flap: 0.8,  begin: 0.3,  opacity: 0.5  },
  { x: 100, y: 34, scale: 0.55, flap: 0.72, begin: 0.15, opacity: 0.45 },
];

function BirdFlock({ className }) {
  return (
    <div className={`aura-day-only aura-flock absolute left-0 ${className}`} aria-hidden="true">
      <svg viewBox="-14 -10 130 66" className="w-32 sm:w-40 overflow-visible">
        {BIRDS.map((b, i) => (
          <g key={i} transform={`translate(${b.x} ${b.y})`}>
            <g className="aura-bird-bob" style={{ animationDelay: `${-i * 0.7}s`, animationDuration: `${2.6 + (i % 3) * 0.5}s` }}>
              <path transform={`scale(${b.scale})`} d={WINGS_MID} fill="currentColor" opacity={b.opacity}>
                <animate attributeName="d" values={FLAP} dur={`${b.flap}s`} begin={`${b.begin}s`}
                  repeatCount="indefinite" calcMode="spline"
                  keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" />
              </path>
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}

// A hot-air balloon far off, drifting slowly across the dawn sky now and
// then: a striped envelope in faded canvas colors, the basket hanging
// below on four lines, the sun catching its left side.
const BALLOON_STRIPES = ['#e9d8c4', '#c9705a', '#e9d8c4', '#7d5a8c', '#e9d8c4', '#c9705a'];

function Balloon({ className }) {
  // The envelope: a round top narrowing to a mouth, split into gores.
  const envelope = 'M 0 -38 C 22 -38 30 -20 26 -6 C 23 6 12 14 6 20 L -6 20 C -12 14 -23 6 -26 -6 C -30 -20 -22 -38 0 -38 Z';
  return (
    <div className={`aura-day-only aura-balloon absolute left-0 ${className}`} aria-hidden="true">
      <svg viewBox="-32 -42 64 82" className="w-9 sm:w-11 overflow-visible aura-balloon-bob">
        <defs>
          <clipPath id="balloon-envelope"><path d={envelope} /></clipPath>
          <linearGradient id="balloon-light" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff6e8" stopOpacity="0.45" />
            <stop offset="0.45" stopColor="#fff6e8" stopOpacity="0" />
            <stop offset="1" stopColor="#3a2a4a" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <g clipPath="url(#balloon-envelope)">
          {BALLOON_STRIPES.map((c, i) => (
            <rect key={i} x={-30 + i * 10} y="-40" width="10.5" height="62" fill={c} />
          ))}
          <rect x="-30" y="-40" width="60" height="62" fill="url(#balloon-light)" />
        </g>
        <path d="M -6 20 L -4.5 29 M 6 20 L 4.5 29 M -2 20 L -2 29 M 2 20 L 2 29" stroke="#5a4660" strokeWidth="0.6" />
        <path d="M -5 29 L 5 29 L 4 36 L -4 36 Z" fill="#6b4d3c" />
      </svg>
    </div>
  );
}

// The full moon on clear nights: a pale disc with faint grey seas and a
// soft glow, sitting well off to one side.
function FullMoon({ className }) {
  return (
    <svg className={`aura-night-only aura-full-moon absolute ${className}`} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="full-moon-face" cx="42%" cy="40%" r="62%">
          <stop offset="0%" stopColor="#fffdf6" />
          <stop offset="80%" stopColor="#ece8db" />
          <stop offset="100%" stopColor="#d6d1c4" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="40" fill="url(#full-moon-face)" />
      <g fill="#a9a6a6" opacity="0.2" style={{ filter: 'blur(1.2px)' }}>
        <path d="M 30 34 C 36 26 48 28 50 36 C 52 44 42 48 34 46 C 28 44 26 40 30 34 Z" />
        <path d="M 54 46 C 60 42 70 46 69 54 C 68 61 58 62 55 57 C 52 53 51 49 54 46 Z" />
        <ellipse cx="44" cy="62" rx="9" ry="6" transform="rotate(-20 44 62)" />
        <ellipse cx="64" cy="30" rx="5" ry="3.5" />
        <circle cx="38" cy="74" r="2.5" />
      </g>
    </svg>
  );
}

// Day and Night share one place, a hillside farm (Meadow.jsx), under a dawn
// sky or a moonlit one. Dawn has a pale morning moon, a few clouds, birds
// and now and then a balloon; night has stars, the full moon and the odd
// shooting star. `page` is the full version for the public pages; `app` is
// the quieter one behind the signed-in app, with the sky details kept to
// the margins.
export function SkyDecor({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-sky absolute inset-0" />
      <div className="aura-night-only absolute inset-0 aura-galaxy-band" />
      <div className="aura-night-only absolute inset-0 aura-stars-1" />
      <div className="aura-night-only absolute inset-0 aura-stars-2" />
      <div className="aura-night-only absolute inset-0">
        <TwinklingStars seed={page ? 3 : 4} count={page ? 70 : 55} />
      </div>
      <span className="aura-night-only aura-shooting-star" />
      {page
        ? <FullMoon className="top-[92px] left-[9%] w-16 sm:w-20" />
        : <FullMoon className="top-[10%] left-[4%] w-14" />}
      {page
        ? <CrescentMoon className="aura-moon-page top-[84px] left-[22%] w-14" />
        : <CrescentMoon className="top-[9%] left-[6%] w-12" />}
      <BirdFlock className={page ? 'top-[96px]' : 'top-[22%]'} />
      <Balloon className={page ? 'top-[17%]' : 'top-[30%]'} />
      {page ? (
        <>
          <FloatingCloud seed={3}  className="aura-float-cloud w-48 sm:w-72 top-[16%] -left-10 sm:left-[6%]" style={{ animationDuration: '34s' }} />
          <FloatingCloud seed={11} className="aura-float-cloud w-40 sm:w-60 top-[30%] -right-12 sm:right-[8%] opacity-80" style={{ animationDuration: '41s', animationDirection: 'reverse' }} />
        </>
      ) : (
        <>
          <FloatingCloud seed={3}  className="aura-float-cloud w-56 top-[14%] -left-16" style={{ animationDuration: '38s' }} />
          <FloatingCloud seed={11} className="aura-float-cloud w-48 top-[46%] -right-12 opacity-80" style={{ animationDuration: '44s', animationDirection: 'reverse' }} />
        </>
      )}
      <Meadow className={page ? 'h-[50vh] min-h-[300px]' : 'h-[40vh] min-h-[240px]'} />
    </>
  );
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Devices that ask for less motion still get moving scenery (Aura's own
// "Animated scenery" setting is what turns it off), just played slower.
function useGentleMotion(ref) {
  useEffect(() => {
    if (!prefersReducedMotion()) return undefined;
    const slow = () => ref.current?.getAnimations?.({ subtree: true })
      .forEach(animation => { animation.playbackRate = 0.6; });
    slow();
    // Catch anything that starts a moment after the scene mounts
    const timer = setTimeout(slow, 500);
    return () => clearTimeout(timer);
  }, [ref]);
}

const SCENES = { sky: SkyDecor, peaks: SnowyPeaks, beach: Duskfall };

// The scenery for a theme: Day and Night share the sky (styled by the
// `dark` class), Snowy Peaks and Duskfall have their own.
export function SceneDecor({ scene, variant = 'page' }) {
  const ref = useRef(null);
  useGentleMotion(ref);
  const Scene = SCENES[scene];
  if (!Scene) return null;
  return (
    <div ref={ref} className="absolute inset-0">
      <Scene variant={variant} />
      <div className="aura-grain absolute inset-0" />
    </div>
  );
}

// ── Rotating scenery on the public pages ────────────────────────────

const HOLD_MS = 12000;  // how long each scene shows
const FADE_MS = 2000;   // crossfade between scenes
const PAUSED_KEY = 'aura-scenery-paused';
const SceneContext = createContext(null);

// Kept across the public pages, so going from Welcome to Sign in carries on
// with the same scene instead of starting over.
let lastSceneIndex = null;

function readPaused() {
  try { return PUBLIC_ROTATION.indexOf(localStorage.getItem(PAUSED_KEY)); } catch { return -1; }
}

function writePaused(id) {
  try {
    if (id) localStorage.setItem(PAUSED_KEY, id);
    else localStorage.removeItem(PAUSED_KEY);
  } catch { /* just not remembered */ }
}

// Starts on the scene someone paused on, else where they left off, else the
// scene closest to their own theme (Light shows Day, Dark shows Night).
function startingScene(themeInfo) {
  const paused = readPaused();
  if (paused >= 0) return paused;
  if (lastSceneIndex !== null) return lastSceneIndex;
  const own = PUBLIC_ROTATION.indexOf(themeInfo.id);
  if (own >= 0) return own;
  return PUBLIC_ROTATION.indexOf(themeInfo.base === 'dark' ? 'night' : 'day');
}

function useSceneRotation() {
  const { themeInfo, setPublicScenes } = useTheme();
  const [index, setIndex] = useState(() => startingScene(themeInfo));
  // Text and buttons switch light/dark halfway through the fade, when the
  // new scene is about as visible as the old one.
  const [foreground, setForeground] = useState(index);
  const [paused, setPaused] = useState(() => readPaused() >= 0);

  useEffect(() => {
    setPublicScenes(true);
    return () => setPublicScenes(false);
  }, [setPublicScenes]);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => setIndex(i => (i + 1) % PUBLIC_ROTATION.length), HOLD_MS);
    return () => clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    lastSceneIndex = index;
    const timer = setTimeout(() => setForeground(index), FADE_MS / 2);
    return () => clearTimeout(timer);
  }, [index]);

  useEffect(() => {
    const bar = getTheme(PUBLIC_ROTATION[foreground]).bar;
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute('content', bar));
  }, [foreground]);

  function togglePaused() {
    writePaused(paused ? null : PUBLIC_ROTATION[index]);
    setPaused(!paused);
  }

  function pick(i) {
    setIndex(i);
    setPaused(true);
    writePaused(PUBLIC_ROTATION[i]);
  }

  return { index, foreground, paused, togglePaused, pick };
}

// Each scene on its own layer, styled light or dark by its own theme. A new
// scene fades in over the old one, which is removed once it's covered.
function SceneLayers({ index }) {
  const [layers, setLayers] = useState([index]);

  useEffect(() => {
    setLayers(prev => (prev[prev.length - 1] === index ? prev : [prev[prev.length - 1], index]));
    const timer = setTimeout(() => setLayers([index]), FADE_MS + 100);
    return () => clearTimeout(timer);
  }, [index]);

  return layers.map((i, n) => {
    const theme = getTheme(PUBLIC_ROTATION[i]);
    const fadingIn = layers.length > 1 && n === layers.length - 1;
    return (
      <div key={theme.id} data-theme={theme.id}
        className={`absolute inset-0 ${theme.base === 'dark' ? 'dark' : ''}`}
        style={fadingIn ? { animation: `sceneFadeIn ${FADE_MS}ms ease-in-out both` } : undefined}>
        <SceneDecor scene={theme.scene} />
      </div>
    );
  });
}

// Tells the glass card or highlight under the mouse where the cursor is, for
// its hover glow (.aura-glass-card in index.css).
function useCardSpotlight() {
  useEffect(() => {
    function onMove(e) {
      const card = e.target.closest?.('.aura-glass-card, .aura-highlight');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    }
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => document.removeEventListener('pointermove', onMove);
  }, []);
}

// The scenery shared by the welcome, about and auth pages. It rotates
// through Day, Snowy Peaks, Night and Duskfall (SiteHeader's controls pause
// it). The content sits above on its own layer with the `aura-heaven`
// colors, switching light/dark with the scene.
export default function AuthBackdrop({ children }) {
  const scenes = useSceneRotation();
  const theme = getTheme(PUBLIC_ROTATION[scenes.foreground]);
  useCardSpotlight();
  return (
    <SceneContext.Provider value={scenes}>
      <div className="relative min-h-screen overflow-hidden bg-[#0d0618]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <SceneLayers index={scenes.index} />
        </div>
        <div data-theme={theme.id}
          className={`aura-heaven ${theme.base === 'dark' ? 'dark' : ''} relative z-10 min-h-screen flex flex-col text-[var(--text-primary)]`}>
          {children}
        </div>
      </div>
    </SceneContext.Provider>
  );
}
