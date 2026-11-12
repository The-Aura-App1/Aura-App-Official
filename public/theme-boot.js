// Apply the saved theme before the app loads, so the page never flashes the
// wrong colors. ThemeContext.jsx keeps these keys up to date. This is its own
// file (not inline in index.html) so the Content Security Policy never has to
// allow inline scripts; see customHttp.yml.
try {
  var themeId = localStorage.getItem('aura-theme-id');
  var base = localStorage.getItem('aura-theme-base');
  if (!themeId) {
    var legacy = localStorage.getItem('aura-theme');
    var dark = legacy ? legacy === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    themeId = dark ? 'night' : 'day';
    base = dark ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', themeId);
  if (base === 'dark') document.documentElement.classList.add('dark');
} catch (e) {}
