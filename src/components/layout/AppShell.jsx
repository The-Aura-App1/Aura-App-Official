import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import Sidebar   from './Sidebar';
import MobileNav from './MobileNav';
import Topbar    from './Topbar';
import { SceneDecor } from '../auth/AuthBackdrop';
import { useTheme } from '../../context/ThemeContext';
import { FeedSkeleton as PageSkeleton } from '../motion/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { hasSeenTour, markTourSeen } from '../../utils/tour';

const AppTour = lazy(() => import('../tour/AppTour'));

// Opens the tour once for each account on this device, and again whenever a
// link adds ?tour=1 (the "App tour" item in the More menu)
function useTour() {
  const { user, dbProfile } = useAuth();
  const [params, setParams] = useSearchParams();
  const asked = params.get('tour') === '1';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (asked || (dbProfile && user?.userId && !hasSeenTour(user.userId))) setOpen(true);
  }, [asked, dbProfile, user?.userId]);

  const close = useCallback(() => {
    setOpen(false);
    markTourSeen(user?.userId);
    if (params.has('tour')) {
      const next = new URLSearchParams(params);
      next.delete('tour');
      setParams(next, { replace: true });
    }
  }, [user?.userId, params, setParams]);

  return [open, close];
}

// Large screens: fixed sidebar on the left. Phones and tablets: a top bar and
// a bottom tab bar instead, so the content gets the full width.
export default function AppShell() {
  const { skyDetails, themeInfo } = useTheme();
  const [tourOpen, closeTour] = useTour();
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">

      {/* Scenery behind the content (Settings > Appearance turns it off) */}
      {skyDetails && themeInfo.scene && (
        <div aria-hidden="true" className="aura-app-sky pointer-events-none fixed inset-y-0 right-0 left-0 lg:left-64 overflow-hidden">
          <SceneDecor scene={themeInfo.scene} variant="app" />
        </div>
      )}
      {/* Themes without scenery get a faint drifting glow instead */}
      {skyDetails && !themeInfo.scene && (
        <div aria-hidden="true" className="aura-ambient pointer-events-none fixed inset-y-0 right-0 left-0 lg:left-64 overflow-hidden" />
      )}

      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 z-30
                        border-r border-[var(--border)] aura-sidebar">
        <Sidebar />
      </aside>

      <div className="relative z-10 flex flex-col min-h-screen lg:ml-64">
        <Topbar />
        {/* Bottom padding clears the phone tab bar */}
        <main className="flex-1 w-full max-w-[672px] mx-auto px-4 pt-4 pb-28 lg:pb-16">
          {/* Pages load on first visit; the bars stay put meanwhile */}
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <MobileNav />

      {tourOpen && (
        <Suspense fallback={null}>
          <AppTour onClose={closeTour} />
        </Suspense>
      )}
    </div>
  );
}
