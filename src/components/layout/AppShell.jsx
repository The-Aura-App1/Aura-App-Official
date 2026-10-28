import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar   from './Sidebar';
import MobileNav from './MobileNav';
import Topbar    from './Topbar';
import { SkyDecor } from '../auth/AuthBackdrop';
import { useTheme } from '../../context/ThemeContext';

// Large screens: fixed sidebar on the left. Phones and tablets: a top bar and
// a bottom tab bar instead, so the content gets the full width.
export default function AppShell() {
  const { skyDetails, themeInfo } = useTheme();
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">

      {/* Scenery behind the content (Settings > Appearance turns it off) */}
      {skyDetails && themeInfo.scene === 'sky' && (
        <div aria-hidden="true" className="aura-app-sky pointer-events-none fixed inset-y-0 right-0 left-0 lg:left-64 overflow-hidden">
          <SkyDecor variant="app" />
        </div>
      )}

      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 z-30
                        border-r border-[var(--border)] bg-[var(--bg-secondary)]">
        <Sidebar />
      </aside>

      <div className="relative z-10 flex flex-col min-h-screen lg:ml-64">
        <Topbar />
        {/* Bottom padding clears the phone tab bar */}
        <main className="flex-1 w-full max-w-[672px] mx-auto px-4 pt-4 pb-28 lg:pb-16">
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
