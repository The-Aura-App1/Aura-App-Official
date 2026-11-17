import { useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getTheme } from '../themes';
import { api } from '../api';
import { studioAllowed, setStudioAllowed, saveCustom, customUpdatedAt } from '../themes/customTheme';

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

// Applies the theme saved on the account once the profile loads, and the
// account's Theme Studio design (Premium) when it's newer than this device's
// custom theme. Designs show only while the account has Premium.
export function ThemeSync() {
  const { setThemeId, refreshCustom } = useTheme();
  const { dbProfile } = useAuth();
  const saved = dbProfile?.theme;
  const premium = dbProfile ? !!dbProfile.isPremium : null;
  const design = dbProfile?.themeDesign;
  useEffect(() => {
    if (premium === null) return;
    const was = studioAllowed();
    setStudioAllowed(premium);
    if (premium && design?.design && (design.updatedAt ?? '') > customUpdatedAt()) saveCustom(design);
    if (was !== premium || premium) refreshCustom();
  }, [premium, design, refreshCustom]);
  useEffect(() => {
    if (getTheme(saved)) setThemeId(saved);
  }, [saved, setThemeId]);
  return null;
}
