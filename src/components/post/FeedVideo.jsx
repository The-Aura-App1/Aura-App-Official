import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

// Videos in posts, Instagram style: they play silently on a loop while mostly
// on screen and pause when scrolled away. No player controls; tapping the
// video (or the small speaker button) turns sound on or off, and that choice
// carries over to the next video.
const PLAY_WHEN_VISIBLE = 0.6;

// One shared sound setting for every video on the page
let soundOn = false;
const listeners = new Set();
const sound = {
  get: () => soundOn,
  set: value => { soundOn = value; listeners.forEach(l => l()); },
  subscribe: l => { listeners.add(l); return () => listeners.delete(l); },
};
export const resetVideoSound = () => sound.set(false);   // for tests

export default function FeedVideo({ src }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [near, setNear]       = useState(false);   // close enough to start loading
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded]   = useState(false);
  const [blocked, setBlocked] = useState(false);   // the browser refused to autoplay
  const unmuted = useSyncExternalStore(sound.subscribe, sound.get);

  // Watch how much of the video is on screen
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    // Two watchers: one starts loading a little before it scrolls in, the
    // other plays it only while most of it is actually on screen
    const loader = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setNear(true);
    }, { rootMargin: '400px 0px' });
    const player = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting && entry.intersectionRatio >= PLAY_WHEN_VISIBLE);
    }, { threshold: [0, PLAY_WHEN_VISIBLE, 1] });
    loader.observe(el);
    player.observe(el);
    return () => { loader.disconnect(); player.disconnect(); };
  }, []);

  // Set on the element itself: phones only autoplay videos that are truly muted
  useEffect(() => {
    if (!ref.current) return;
    ref.current.defaultMuted = true;
    ref.current.disablePictureInPicture = true;   // no floating player either
    ref.current.muted = !unmuted;
  }, [unmuted]);

  // Play while visible, pause (and stay put) when not. Only a browser refusal
  // (NotAllowedError) counts as blocked; other failures just retry next time.
  useEffect(() => {
    const video = ref.current;
    if (!video || !near) return;
    if (visible) {
      video.play()?.then(() => setBlocked(false), err => setBlocked(err?.name === 'NotAllowedError'));
    } else {
      video.pause();
    }
  }, [visible, near]);

  function toggleSound(e) {
    e.stopPropagation();
    const video = ref.current;
    if (blocked && video) {
      // Low-power modes can block autoplay; a tap always starts it
      video.play().then(() => setBlocked(false), () => {});
      return;
    }
    sound.set(!unmuted);
  }

  return (
    <div className="absolute inset-0" onClick={toggleSound}>
      <video
        ref={ref}
        src={near ? src : undefined}
        className={`w-full h-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        muted={!unmuted}
        loop
        playsInline
        preload={near ? 'auto' : 'none'}
        onLoadedData={() => setLoaded(true)}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-label="Video"
      />

      {/* Blocked autoplay (e.g. battery saver): a play button, tap to start */}
      {blocked && !playing && (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <span className="w-14 h-14 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center">
            <span className="ml-1 w-0 h-0 border-y-[11px] border-y-transparent border-l-[18px] border-l-white" />
          </span>
        </span>
      )}

      <button type="button" onClick={toggleSound} aria-label={unmuted ? 'Mute' : 'Turn sound on'}
        aria-pressed={unmuted}
        className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm
                   flex items-center justify-center text-white hover:bg-black/70 transition-colors">
        {unmuted ? <Volume2 size={15} /> : <VolumeX size={15} />}
      </button>
    </div>
  );
}
