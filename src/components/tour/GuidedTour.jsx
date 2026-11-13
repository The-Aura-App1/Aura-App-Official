import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { stepsFor } from './tourSteps';
import { placeCard, findTarget } from './placement';
import { prefersReducedMotion } from '../../utils/motion';

// Posting from any step on the post page jumps to "your first post is live"
const WITH_POST   = stepsFor({ posted: true });
const POST_FROM   = WITH_POST.findIndex(s => s.id === 'go-post');
const POSTED_STEP = WITH_POST.findIndex(s => s.id === 'posted');

const FIND_FOR_MS = 3500;   // pages load lazily; keep looking this long
const PAD         = 6;      // spotlight padding around the element
const CARD_WIDTH  = 320;

function routeFor(step, username) {
  return step.route === 'profile' ? `/profile/${encodeURIComponent(username || '')}` : step.route;
}

function onRoute(pathname, step) {
  return step.route === 'profile' ? pathname.startsWith('/profile/') : pathname === step.route;
}

// Inside the fixed bars (sidebar, tab bar) scrolling does nothing
function isPinned(el) {
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    const { position } = getComputedStyle(node);
    if (position === 'fixed' || position === 'sticky') return true;
  }
  return false;
}

// Brings the element into view, leaving room for the note below it
function bringIntoView(el) {
  if (isPinned(el)) return;
  const box  = el.getBoundingClientRect();
  const view = window.innerHeight;
  const tall = box.height > view * 0.45;
  const want = tall ? 72 : Math.max(72, view * 0.3 - box.height / 2);
  if (box.top >= 64 && box.bottom <= view * 0.6 && !tall) return;
  window.scrollTo({ top: window.scrollY + box.top - want, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

function measure(el) {
  const b = el.getBoundingClientRect();
  return {
    top: b.top - PAD, left: b.left - PAD, width: b.width + PAD * 2, height: b.height + PAD * 2,
    right: b.right + PAD, bottom: b.bottom + PAD,
  };
}

// The page-by-page walkthrough: a spotlight on the real button with a note
// beside it. The page stays usable underneath, so people can try things
// (and make their first post) as they go.
export default function GuidedTour({ onClose }) {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const { username } = useAuth();
  const [posted, setPosted] = useState(false);
  const steps = stepsFor({ posted });
  const [index, setIndex]   = useState(0);
  const [dir, setDir]       = useState(1);
  const [rect, setRect]     = useState(null);
  const [searching, setSearching] = useState(true);
  const [cardSize, setCardSize]   = useState({ width: CARD_WIDTH, height: 180 });
  const [view, setView] = useState({ width: window.innerWidth, height: window.innerHeight });
  const cardRef   = useRef(null);
  const targetRef = useRef(null);

  const step   = steps[Math.min(index, steps.length - 1)];
  const isLast = index >= steps.length - 1;

  const go = useCallback(delta => {
    const next = index + delta;
    if (next >= steps.length) { onClose(); return; }
    setDir(delta);
    setIndex(Math.max(0, next));
  }, [index, steps.length, onClose]);
  // Timers and listeners call the latest version
  const goRef = useRef(go);
  goRef.current = go;

  // Each step opens its page first
  useEffect(() => {
    if (!onRoute(pathname, step)) navigate(routeFor(step, username));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nav steps: opening the page (by tapping the real button) moves on
  useEffect(() => {
    if (step.goTo && pathname === step.goTo) goRef.current(1);
  }, [pathname, step]);

  // The first post: whenever it happens on the post page, let the send-off
  // play, then celebrate it
  useEffect(() => {
    let timer;
    const done = () => {
      setPosted(true);
      timer = setTimeout(() => {
        setDir(1);
        setIndex(i => (i >= POST_FROM && i < POSTED_STEP ? POSTED_STEP : i));
      }, prefersReducedMotion() ? 400 : 900);
    };
    window.addEventListener('aura:post-created', done);
    return () => { window.removeEventListener('aura:post-created', done); clearTimeout(timer); };
  }, []);

  // Find the element, bring it into view, then follow it as the page moves
  useEffect(() => {
    targetRef.current = null;
    if (!step.target) { setRect(null); setSearching(false); return undefined; }
    if (!onRoute(pathname, step)) { setRect(null); setSearching(true); return undefined; }

    // The note glides from the last element to the next; if the next one is
    // slow to appear (a page still loading), it waits in the middle instead
    setSearching(true);
    let found = null;
    const parked = setTimeout(() => { if (!found) setRect(null); }, 300);
    const started = Date.now();
    const update = () => { if (found) setRect(measure(found)); };
    const look = setInterval(() => {
      found = findTarget(step.target);
      if (found) {
        clearInterval(look);
        targetRef.current = found;
        setSearching(false);
        bringIntoView(found);
        update();
      } else if (Date.now() - started > FIND_FOR_MS) {
        clearInterval(look);
        setSearching(false);
        if (step.skipIfMissing) goRef.current(dir);
      }
    }, 120);

    // Scrolling, resizing and pages settling all move things around
    const follow = setInterval(update, 400);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      clearTimeout(parked);
      clearInterval(look);
      clearInterval(follow);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [step, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onResize = () => setView({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // The note's size decides where it fits; it changes with each step's text
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return undefined;
    const update = () => {
      const box = el.getBoundingClientRect();
      setCardSize(prev => (Math.abs(box.height - prev.height) > 1 || Math.abs(box.width - prev.width) > 1
        ? { width: box.width, height: box.height } : prev));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function primary() {
    if (step.goTo) navigate(step.goTo);   // arriving there moves the tour on
    else go(1);
  }

  const width = Math.min(CARD_WIDTH, view.width - 24);
  const spot  = step.target ? rect : null;
  const place = placeCard(spot, { width, height: cardSize.height }, view);
  const counter = `${index + 1} of ${steps.length}`;

  return (
    <div className="aura-tour" aria-live="polite">
      {/* Dims the page around the element; clicks pass straight through */}
      {spot ? (
        // keys keep React from reusing the dim layer, which would slide in from the corner
        <div key="spot" aria-hidden="true" className="aura-tour-spot"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }} />
      ) : (
        <div key="dim" aria-hidden="true" className="aura-tour-dim" />
      )}

      <div ref={cardRef} role="dialog" aria-label={`Tour: ${step.title}`}
        className={`aura-tour-card aura-tour-${place.side}`}
        style={{ top: place.top, left: place.left, width }}>
        {place.arrow !== null && (
          <span aria-hidden="true" className="aura-tour-arrow"
            style={place.side === 'below' || place.side === 'above' ? { left: place.arrow } : { top: place.arrow }} />
        )}

        <div key={step.id} className="aura-arrive">
          <div className="flex items-center justify-between mb-1.5">
            <p className="aura-kicker text-[10px] font-bold uppercase tracking-[0.18em]">Tour · {counter}</p>
            {!isLast && (
              <button type="button" onClick={onClose} aria-label="Skip tour"
                className="-mr-1 flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                Skip <X size={13} />
              </button>
            )}
          </div>
          <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)] leading-snug">{step.title}</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-1">{step.body}</p>
          {step.target && searching && (
            <p className="text-xs text-[var(--text-muted)] mt-2">Finding it on the page…</p>
          )}

          <div className="flex items-center gap-2 mt-4">
            {index > 0 && (
              <button type="button" onClick={() => go(-1)} aria-label="Back"
                className="btn-secondary px-3 py-2 text-sm flex items-center"><ChevronLeft size={16} /></button>
            )}
            <button type="button" onClick={primary}
              className={`${step.waitFor ? 'btn-secondary' : 'btn-primary'} flex-1 py-2 text-sm`}>
              {step.next ?? (isLast ? 'Done' : 'Next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
