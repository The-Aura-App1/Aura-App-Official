import React, { createContext, useContext, useEffect, useState } from 'react';
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
  const [themeId, setThemeId] = useState(initialThemeId);
  const themeInfo = getTheme(themeId) ?? getTheme('day');

  // Clouds, stars and other scenery behind the app. On unless turned off.
  const [skyDetails, setSkyDetails] = useState(() => readStorage('aura-sky-details') !== 'off');

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = themeInfo.id;
    root.classList.toggle('dark', themeInfo.base === 'dark');
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute('content', themeInfo.bar));
    writeStorage(THEME_KEY, themeInfo.id);
    writeStorage(BASE_KEY, themeInfo.base);
  }, [themeInfo]);

  useEffect(() => {
    writeStorage('aura-sky-details', skyDetails ? 'on' : 'off');
  }, [skyDetails]);

  return (
    <ThemeContext.Provider value={{
      themeId: themeInfo.id, themeInfo, setThemeId,
      // 'light' or 'dark', for styling that only cares about the base
      theme: themeInfo.base,
      skyDetails, setSkyDetails,
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
