import { useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getTheme } from '../themes';
import { api } from '../api';

// Switches the theme when the person picks one, and saves it to their account
// (when signed in) so it follows them to other devices. Saving is best effort:
// the theme still applies on this device if the request fails.
export default function useChooseTheme() {
  const { setThemeId } = useTheme();
  const { dbProfile } = useAuth();
  return id => {
    if (!getTheme(id)) return;
    setThemeId(id);
    if (dbProfile) api.updateProfile({ theme: id }).catch(() => {});
  };
}

// Applies the theme saved on the account once the profile loads.
export function ThemeSync() {
  const { setThemeId } = useTheme();
  const { dbProfile } = useAuth();
  const saved = dbProfile?.theme;
  useEffect(() => {
    if (getTheme(saved)) setThemeId(saved);
  }, [saved, setThemeId]);
  return null;
}
