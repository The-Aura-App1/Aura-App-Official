import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, PlusSquare, LogOut, Moon, Sun, User, Users, ChevronDown, MoreHorizontal, Search } from 'lucide-react';
import { useAuth }  from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Wordmark from '../brand/Wordmark';
import { ThemeMenu } from '../theme/ThemePicker';
import useUnreadCount from '../../hooks/useUnreadCount';
import NotifyBell from './NotifyBell';
import { moreItems, isMorePath } from './navItems';

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
    isActive
      ? 'aura-nav-active font-semibold'
      : 'text-[var(--text-muted)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)]'
  }`;

// Five main destinations, then everything else folded under "More" so the
// sidebar stays calm as the app grows.
export default function Sidebar() {
  const { displayName, username, logout, dbProfile } = useAuth();
  const { theme, themeInfo } = useTheme();
  const navigate    = useNavigate();
  const { pathname } = useLocation();
  const unreadCount = useUnreadCount();
  const [moreOpen, setMoreOpen] = useState(() => isMorePath(pathname));

  // Opening a page from "More" (from a link elsewhere, say) unfolds it
  useEffect(() => { if (isMorePath(pathname)) setMoreOpen(true); }, [pathname]);

  const MAIN = [
    { to: '/',              icon: Home,       label: 'Feed' },
    { to: '/groups',        icon: Users,      label: 'Groups' },
    { to: '/create',        icon: PlusSquare, label: 'Post' },
    { to: '/notifications', bell: true,       label: 'Notifications' },
    { to: `/profile/${encodeURIComponent(username || displayName || '')}`, icon: User, label: 'Profile' },
  ];

  async function handleLogout() {
    await logout();
    navigate('/welcome');
  }

  return (
    <div className="flex flex-col h-full px-4 py-6 overflow-y-auto">
      <div className="flex items-center px-2 pt-2 mb-8">
        <Wordmark className="text-4xl" />
      </div>

      {/* Search is a field, not a tab, so the five main tabs stay five */}
      <Link to="/search"
        className="mb-4 flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm border border-[var(--border)]
                   bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-aura-500/40 hover:text-[var(--text-primary)] transition-colors">
        <Search size={16} />
        Search
      </Link>

      <nav className="flex flex-col gap-1 flex-1">
        {MAIN.map(({ to, icon: Icon, label, bell }) => (
          <NavLink key={label} to={to} end={to === '/'} className={linkClass}>
            {bell ? <NotifyBell count={unreadCount} size={20} /> : <Icon size={20} />}
            {label}
          </NavLink>
        ))}

        <button onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen}
          className="mt-2 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[var(--text-muted)]
                     hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)] transition-all duration-200">
          <MoreHorizontal size={20} />
          More
          <ChevronDown size={16} className={`ml-auto transition-transform duration-300 ${moreOpen ? 'rotate-180' : ''}`} />
        </button>
        <div className={`aura-fold ${moreOpen ? '' : 'is-leaving'}`} aria-hidden={!moreOpen}>
          <div className="flex flex-col gap-1 pl-3">
            {moreItems(!!dbProfile?.isAdmin).map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={linkClass} tabIndex={moreOpen ? 0 : -1}>
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <div className="flex flex-col gap-2 mt-6">
        <ThemeMenu placement="above" align="left" buttonClassName="btn-ghost w-full justify-start gap-3 text-sm">
          {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          Theme: {themeInfo.name}
        </ThemeMenu>
        <div className="flex items-center justify-between px-2
                        border-t border-[var(--border)] pt-4 mt-2">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {displayName}
          </span>
          <button onClick={handleLogout}
            className="p-2 rounded-lg text-[var(--text-muted)]
                       hover:text-red-400 hover:bg-red-400/10
                       transition-all duration-200"
            title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
