// Marks the page as scrolling (html.is-scrolling) until it has been still for
// a moment. index.css pauses the scenery meanwhile, so phones put their effort
// into a smooth scroll.
export default function startScrollCalm() {
  const root = document.documentElement;
  let timer = null;
  const settle = () => { root.classList.remove('is-scrolling'); timer = null; };
  window.addEventListener('scroll', () => {
    if (!timer) root.classList.add('is-scrolling');
    else clearTimeout(timer);
    timer = setTimeout(settle, 220);
  }, { passive: true, capture: true });
}
