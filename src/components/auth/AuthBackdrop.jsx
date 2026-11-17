import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { getTheme, PUBLIC_ROTATION } from '../../themes';
import SnowyPeaks from '../scenes/SnowyPeaks';
import Duskfall from '../scenes/Duskfall';
import NorthernLights from '../scenes/NorthernLights';
import FireflyGrove from '../scenes/FireflyGrove';
import SkyIsles from '../scenes/SkyIsles';
import Abyss from '../scenes/Abyss';
import GoldenDunes from '../scenes/GoldenDunes';
import LanternLake from '../scenes/LanternLake';
import CitySkies from '../scenes/CitySkies';
import TwinklingStars from '../scenes/TwinklingStars';
import { CloudBank, FloatingCloud } from '../scenes/Clouds';
import ShootingStars from '../scenes/ShootingStars';
import BirdFlock from '../scenes/Birds';
import Balloon from '../scenes/Balloon';
import NightMoon from '../scenes/NightMoon';
import { SkyField, AppSkyConstellations, SkyContentContext } from '../scenes/Constellations';
import '../scenes/scenes.css';
import BrandWordmark from '../brand/Wordmark';

// Fixed positions so the sparkles don't jump around between renders.
const SPARKLES = [
  { top: '12%', left: '14%', size: 14, delay: '0s'   },
  { top: '22%', left: '82%', size: 18, delay: '1.2s' },
  { top: '48%', left: '6%',  size: 10, delay: '2.1s' },
  { top: '38%', left: '90%', size: 12, delay: '0.6s' },
  { top: '6%',  left: '62%', size: 8,  delay: '1.7s' },
  { top: '30%', left: '28%', size: 9,  delay: '2.8s' },
  { top: '8%',  left: '38%', size: 8,  delay: '3.3s' },
];

function Sparkle({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z" />
    </svg>
  );
}

// The logo on the public pages. `size` picks the landing-page version (under
// the big halo, so without its own) or the compact one above the auth forms.
export function Wordmark({ size = 'lg', linked = false }) {
  const text = size === 'lg'
    ? <BrandWordmark halo={false} className="text-6xl min-[400px]:text-7xl sm:text-8xl md:text-[min(8rem,16vh)] xl:text-[min(9rem,17vh)]" />
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
        <img src="/logo192.png" alt="Aura App" className="w-9 h-9 rounded-xl" />
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

// The sky itself: a dawn sky with clouds in light mode, a galaxy in dark mode.
// `page` is the full version for the public pages, with the sun and light
// rays; `app` is the quieter version behind the signed-in app, without rays
// and with the floating clouds and constellation kept to the side margins.
export function SkyDecor({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-sky absolute inset-0" />
      <div className="aura-night-only absolute inset-0 aura-galaxy-band" />
      {/* Stars fade out above the cloud bank rather than shining through it */}
      <div className="aura-night-only aura-above-clouds absolute inset-0 aura-stars-1" />
      <div className="aura-night-only aura-above-clouds absolute inset-0 aura-stars-2" />
      <div className="aura-night-only aura-above-clouds absolute inset-0">
        <TwinklingStars seed={page ? 3 : 4} count={page ? 70 : 55} />
      </div>
      <ShootingStars />
      {page ? <SkyField /> : <AppSkyConstellations />}
      {/* Night's moon: on the public pages SkyField places it clear of the text */}
      {/* behind the app only where there's a margin (on phones it sat behind the top buttons) */}
      {!page && <div className="hidden lg:block"><NightMoon className="left-[7%] top-[63%] w-16" /></div>}
      {page
        ? <CrescentMoon className="aura-moon-page top-[84px] left-[22%] w-14" />
        : <CrescentMoon className="top-[9%] left-[6%] w-12" />}
      <BirdFlock className={`aura-day-only aura-flock ${page ? 'top-[96px]' : 'top-[22%]'}`} />
      <Balloon className={`aura-day-only aura-balloon ${page ? 'top-[17%]' : 'top-[30%]'}`} />
      {page && <div className="aura-rays absolute inset-0" />}
      {page && <div className="aura-sun absolute left-1/2 w-[46rem] h-[46rem] -ml-[23rem]" />}
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
      {SPARKLES.map((s, i) => (
        <span key={i} className="aura-twinkle absolute text-amber-200 dark:text-aura-100"
          style={{ top: s.top, left: s.left, animationDelay: s.delay }}>
          <Sparkle size={s.size} />
        </span>
      ))}
      <CloudBank />
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

const SCENES = { sky: SkyDecor, peaks: SnowyPeaks, beach: Duskfall, city: CitySkies, aurora: NorthernLights, grove: FireflyGrove, isles: SkyIsles, deep: Abyss, dunes: GoldenDunes, lanterns: LanternLake };

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

// Tells the glass card under the mouse where the cursor is, for
// its hover glow (.aura-glass-card in index.css).
function useCardSpotlight() {
  useEffect(() => {
    function onMove(e) {
      const card = e.target.closest?.('.aura-glass-card');
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
// through Day, City Skies, Snowy Peaks, Night and Duskfall (SiteHeader's controls pause
// it). The content sits above on its own layer with the `aura-heaven`
// colors, switching light/dark with the scene. `className` can move Day's
// glow (see .aura-glow-on-halo).
export default function AuthBackdrop({ children, className = '' }) {
  const scenes = useSceneRotation();
  const theme = getTheme(PUBLIC_ROTATION[scenes.foreground]);
  useCardSpotlight();
  // The sky keeps its constellations clear of what's in here
  const contentRef = useRef(null);
  return (
    <SceneContext.Provider value={scenes}>
      <SkyContentContext.Provider value={contentRef}>
        <div className={`aura-scenery relative min-h-screen overflow-hidden bg-[#0d0618] ${className}`}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <SceneLayers index={scenes.index} />
          </div>
          <div ref={contentRef} data-theme={theme.id}
            className={`aura-heaven ${theme.base === 'dark' ? 'dark' : ''} relative z-10 min-h-screen flex flex-col text-[var(--text-primary)]`}>
            {children}
          </div>
        </div>
      </SkyContentContext.Provider>
    </SceneContext.Provider>
  );
}
