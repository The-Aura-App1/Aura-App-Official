// Where the tour's note goes next to the highlighted element.
// rect: the element's box (or null), card: { width, height } of the note,
// view: { width, height } of the window. Returns { top, left, side, arrow },
// where side is where the note sits relative to the element and arrow is the
// arrow's offset along the note's edge (px), pointing at the element's middle.
export const GAP    = 14;   // between the element and the note
export const MARGIN = 12;   // from the window edges

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

export function placeCard(rect, card, view) {
  const { width: w, height: h } = card;

  if (!rect) {
    return {
      side: 'none', arrow: null,
      left: clamp((view.width - w) / 2, MARGIN, view.width - w - MARGIN),
      top:  clamp((view.height - h) / 2, MARGIN, view.height - h - MARGIN),
    };
  }

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const room = {
    below: view.height - rect.bottom - GAP - MARGIN,
    above: rect.top - GAP - MARGIN,
    right: view.width - rect.right - GAP - MARGIN,
    left:  rect.left - GAP - MARGIN,
  };

  const horizontal = top => {
    const left = clamp(cx - w / 2, MARGIN, view.width - w - MARGIN);
    return { top, left, arrow: clamp(cx - left, 18, w - 18) };
  };
  const vertical = left => {
    const top = clamp(cy - h / 2, MARGIN, view.height - h - MARGIN);
    return { top, left, arrow: clamp(cy - top, 18, h - 18) };
  };

  // Things in the desktop sidebar get their note beside them, over the page
  if (rect.right < view.width * 0.3 && room.right >= w) return { side: 'right', ...vertical(rect.right + GAP) };
  if (room.below >= h) return { side: 'below', ...horizontal(rect.bottom + GAP) };
  if (room.above >= h) return { side: 'above', ...horizontal(rect.top - GAP - h) };
  if (room.right >= w) return { side: 'right', ...vertical(rect.right + GAP) };
  if (room.left  >= w) return { side: 'left',  ...vertical(rect.left - GAP - w) };

  // A big element (a whole section): sit over its roomier end, still pointing at it
  return room.below >= room.above
    ? { ...horizontal(view.height - h - MARGIN), side: 'inside-bottom', arrow: null }
    : { ...horizontal(MARGIN), side: 'inside-top', arrow: null };
}

// The first element with this data-tour value that's actually on screen
// (phones and desktops each tag their own navigation)
export function findTarget(name, root = document) {
  for (const el of root.querySelectorAll(`[data-tour="${name}"]`)) {
    const box = el.getBoundingClientRect();
    if (box.width > 0 && box.height > 0 && !el.closest('[aria-hidden="true"]')) return el;
  }
  return null;
}
