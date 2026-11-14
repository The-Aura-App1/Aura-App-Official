import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';

// Videos in posts, Instagram style. They play silently on a loop while
// mostly on screen and pause when scrolled away. There are no browser player
// controls: tapping the video pauses or resumes it, and the small speaker
// button turns sound on or off (that choice carries over to every video).
// On the post page (`seekable`) a seek bar lets people jump to any point.
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

// Where each video was left, so opening the post (or coming back) picks up there
const lastTimes = new Map();
export const videoTimeFor = src => lastTimes.get(src) ?? 0;

function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function SeekBar({ videoRef, time, duration, onScrub }) {
  const barRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const fraction = duration ? Math.min(1, time / duration) : 0;

  function seekTo(clientX) {
    const box = barRef.current.getBoundingClientRect();
    const at = Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * duration;
    if (videoRef.current && Number.isFinite(at)) videoRef.current.currentTime = at;
    onScrub(at);
  }

  function down(e) {
    e.stopPropagation();
    if (!duration) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    seekTo(e.clientX);
  }

  function key(e) {
    if (!duration || !videoRef.current) return;
    const step = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0;
    if (!step) return;
    e.preventDefault();
    const at = Math.min(duration, Math.max(0, videoRef.current.currentTime + step));
    videoRef.current.currentTime = at;
    onScrub(at);
  }

  return (
    <div className="absolute inset-x-0 bottom-0 px-3 pb-2 pt-6 bg-gradient-to-t from-black/50 to-transparent"
      onClick={e => e.stopPropagation()}>
      {dragging && (
        <p className="text-center text-xs font-semibold text-white mb-1 tabular-nums drop-shadow">
          {clock(time)} / {clock(duration)}
        </p>
      )}
      <div ref={barRef} role="slider" tabIndex={0} aria-label="Seek"
        aria-valuemin={0} aria-valuemax={Math.round(duration || 0)} aria-valuenow={Math.round(time)}
        aria-valuetext={`${clock(time)} of ${clock(duration)}`}
        onPointerDown={down}
        onPointerMove={e => dragging && seekTo(e.clientX)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={key}
        className="group relative h-5 flex items-center cursor-pointer touch-none outline-none">
        <div className={`relative w-full rounded-full bg-white/30 transition-all ${dragging ? 'h-1.5' : 'h-1 group-hover:h-1.5'}`}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${fraction * 100}%` }} />
        </div>
        <span className={`absolute w-3.5 h-3.5 -ml-[7px] rounded-full bg-white shadow transition-transform
                          ${dragging ? 'scale-100' : 'scale-0 group-hover:scale-100 group-focus-visible:scale-100'}`}
          style={{ left: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}

export default function FeedVideo({ src, seekable = false }) {
  const ref = useRef(null);
  const [visible, setVisible]   = useState(false);
  const [near, setNear]         = useState(false);   // close enough to start loading
  const [playing, setPlaying]   = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const [blocked, setBlocked]   = useState(false);   // the browser refused to autoplay
  const [held, setHeld]         = useState(false);   // the viewer paused it
  const [flash, setFlash]       = useState(null);    // { id, icon } shown briefly after a tap
  const [time, setTime]         = useState(0);
  const [duration, setDuration] = useState(0);
  const unmuted = useSyncExternalStore(sound.subscribe, sound.get);

  // Two watchers: one starts loading a little before it scrolls in, the
  // other plays it only while most of it is actually on screen
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
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

  // Scrolling away and back starts it again, like Instagram
  useEffect(() => { if (!visible) setHeld(false); }, [visible]);

  // Play while visible (unless the viewer paused it), pause when not. Only a
  // browser refusal (NotAllowedError) counts as blocked.
  useEffect(() => {
    const video = ref.current;
    if (!video || !near) return;
    if (visible && !held) {
      video.play()?.then(() => setBlocked(false), err => setBlocked(err?.name === 'NotAllowedError'));
    } else {
      video.pause();
    }
  }, [visible, near, held]);

  function togglePlay(e) {
    e.stopPropagation();
    const video = ref.current;
    if (!video) return;
    if (blocked || video.paused) {
      // Un-pausing lets the play effect start it; otherwise start it here
      if (held) setHeld(false);
      else video.play()?.then(() => setBlocked(false), () => {});
      setFlash({ id: Date.now(), icon: 'play' });
    } else {
      setHeld(true);
      video.pause();
      setFlash({ id: Date.now(), icon: 'pause' });
    }
  }

  function toggleSound(e) {
    e.stopPropagation();
    sound.set(!unmuted);
  }

  function resume() {
    const video = ref.current;
    const at = lastTimes.get(src);
    if (video && at && at < (video.duration || Infinity) - 0.25) video.currentTime = at;
    setDuration(video?.duration || 0);
  }

  const showPlayButton = (blocked || held) && !playing;
  const FlashIcon = flash?.icon === 'pause' ? Pause : Play;

  return (
    <div className="absolute inset-0 cursor-pointer select-none" onClick={togglePlay} data-video>
      <video
        ref={ref}
        src={near ? src : undefined}
        className={`w-full h-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        muted={!unmuted}
        loop
        playsInline
        preload={near ? 'auto' : 'none'}
        onLoadedMetadata={resume}
        onLoadedData={() => setLoaded(true)}
        onDurationChange={e => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={e => { lastTimes.set(src, e.currentTarget.currentTime); if (seekable) setTime(e.currentTarget.currentTime); }}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-label="Video"
      />

      {/* A quick play or pause icon after a tap */}
      {flash && !showPlayButton && (
        <span key={flash.id} aria-hidden="true" className="aura-video-flash absolute inset-0 flex items-center justify-center pointer-events-none"
          onAnimationEnd={() => setFlash(null)}>
          <span className="w-16 h-16 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white">
            <FlashIcon size={28} fill="currentColor" className={flash.icon === 'play' ? 'ml-1' : ''} />
          </span>
        </span>
      )}

      {/* Paused by the viewer, or blocked by the phone: a play button */}
      {showPlayButton && (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="w-16 h-16 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white">
            <Play size={28} fill="currentColor" className="ml-1" />
          </span>
        </span>
      )}

      <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} className="sr-only">
        {playing ? 'Pause' : 'Play'}
      </button>

      {seekable && (
        <SeekBar videoRef={ref} time={time} duration={duration} onScrub={setTime} />
      )}

      <button type="button" onClick={toggleSound} aria-label={unmuted ? 'Mute' : 'Turn sound on'}
        aria-pressed={unmuted}
        className={`absolute right-3 w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm
                   flex items-center justify-center text-white hover:bg-black/70 transition-colors
                   ${seekable ? 'bottom-10' : 'bottom-3'}`}>
        {unmuted ? <Volume2 size={15} /> : <VolumeX size={15} />}
      </button>
    </div>
  );
}
