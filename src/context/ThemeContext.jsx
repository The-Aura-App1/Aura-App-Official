import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { getTheme, defaultThemeId } from '../themes';

const ThemeContext = createContext(null);

// public/index.html reads these too, to apply the theme before the app loads.
const THEME_KEY = 'aura-theme-id';
const BASE_KEY  = 'aura-theme-base';

function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode: theme just isn't remembered */ }
}

function initialThemeId() {
  const stored = readStorage(THEME_KEY);
  if (getTheme(stored)) return stored;
  // Before themes, 'aura-theme' held 'light' or 'dark', which are now Day and Night.
  const legacy = readStorage('aura-theme');
  if (legacy === 'dark')  return 'night';
  if (legacy === 'light') return 'day';
  return defaultThemeId();
}

// The theme applies on this device straight away. useChooseTheme also saves
// it to the account, and ThemeSync applies the account's theme on sign-in.
export function ThemeProvider({ children }) {
  const [themeId, setThemeIdNow] = useState(initialThemeId);
  const themeInfo = getTheme(themeId) ?? getTheme('day');
  const currentId = useRef(themeId);
  currentId.current = themeId;

  // Switching themes crossfades the whole screen, scenery included. Browsers
  // without view transitions blend the colors instead.
  const setThemeId = useCallback(id => {
    if (!id || id === currentId.current) return;
    const root = document.documentElement;
    if (document.startViewTransition) {
      document.startViewTransition(() => flushSync(() => setThemeIdNow(id)));
      return;
    }
    root.classList.add('aura-theme-blend');
    setThemeIdNow(id);
    clearTimeout(setThemeId.timer);
    setThemeId.timer = setTimeout(() => root.classList.remove('aura-theme-blend'), 700);
  }, []);

  // Clouds, stars and other scenery behind the app. On unless turned off.
  const [skyDetails, setSkyDetails] = useState(() => readStorage('aura-sky-details') !== 'off');

  // The public pages rotate through scenes of both brightnesses, and each
  // scene sets its own light or dark styling. While they're showing, the page
  // itself must not be `dark`, or Day's scenery would pick up Night's styles.
  const [publicScenes, setPublicScenes] = useState(false);

  // Layout effect, so the new theme is on the page before a crossfade captures it
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = themeInfo.id;
    root.classList.toggle('dark', themeInfo.base === 'dark' && !publicScenes);
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute('content', themeInfo.bar));
    writeStorage(THEME_KEY, themeInfo.id);
    writeStorage(BASE_KEY, themeInfo.base);
  }, [themeInfo, publicScenes]);

  useEffect(() => {
    writeStorage('aura-sky-details', skyDetails ? 'on' : 'off');
  }, [skyDetails]);

  return (
    <ThemeContext.Provider value={{
      themeId: themeInfo.id, themeInfo, setThemeId,
      // 'light' or 'dark', for styling that only cares about the base
      theme: themeInfo.base,
      skyDetails, setSkyDetails,
      setPublicScenes,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
