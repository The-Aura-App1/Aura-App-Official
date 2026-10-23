import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar   from './Sidebar';
import MobileNav from './MobileNav';
import Topbar    from './Topbar';

export default function AppShell() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">

      {/* Sidebar — always visible on desktop */}
      <aside style={{
        width: '256px',
        flexShrink: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        borderRight: '1px solid var(--border)',
        backgroundColor: 'var(--bg-secondary)',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Sidebar />
      </aside>

      {/* Main content */}
      <div style={{ marginLeft: '256px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <main style={{ flex: 1, width: '100%', maxWidth: '672px', margin: '0 auto', padding: '16px 16px 64px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}