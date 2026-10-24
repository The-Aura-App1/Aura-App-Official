import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, PlusSquare, Wallet, Settings, Users } from 'lucide-react';

const NAV = [
  { to: '/',         icon: Home,       label: 'Feed'     },
  { to: '/groups',   icon: Users,      label: 'Groups'   },
  { to: '/create',   icon: PlusSquare, label: 'Post'     },
  { to: '/wallet',   icon: Wallet,     label: 'Wallet'   },
  { to: '/settings', icon: Settings,   label: 'Settings' },
];

export default function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40
                    bg-[var(--bg-secondary)] border-t border-[var(--border)]
                    flex items-center justify-around px-2 py-1">
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
              isActive ? 'text-aura-400' : 'text-[var(--text-muted)]'
            }`
          }>
          {({ isActive }) => (
            <>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}