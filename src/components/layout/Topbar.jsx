import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Moon, Sun, User } from 'lucide-react';
import NotifyBell from './NotifyBell';
import { useTheme } from '../../context/ThemeContext';
import { ThemeMenu } from '../theme/ThemePicker';
import { useAuth } from '../../context/AuthContext';
import useUnreadCount from '../../hooks/useUnreadCount';
import Wordmark from '../brand/Wordmark';

// Top bar on phones and tablets (the sidebar takes over on large screens).
export default function Topbar() {
  const { theme } = useTheme();
  const { displayName, username } = useAuth();
  const unreadCount = useUnreadCount();

  const iconClass = ({ isActive }) =>
    `relative p-2 rounded-xl transition-all duration-200 ${
      isActive
        ? 'text-[var(--accent)] bg-aura-500/15 shadow-aura-sm'
        : 'text-[var(--text-muted)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)]'
    }`;

  return (
    <header className="lg:hidden sticky top-0 z-20
                       aura-bar aura-bar-top
                       flex items-center justify-between px-4 h-14">
      <Link to="/" aria-label="Aura App home" className="flex items-center pt-1">
        <Wordmark className="text-3xl" />
      </Link>
      <div className="flex items-center gap-1">
        <NavLink to="/notifications" aria-label="Notifications" className={iconClass}>
          <NotifyBell count={unreadCount} size={20} />
        </NavLink>
        <NavLink to={`/profile/${username || displayName}`} aria-label="Profile" className={iconClass}>
          <User size={20} />
        </NavLink>
        <ThemeMenu buttonClassName="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)] transition-all duration-200">
          {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
        </ThemeMenu>
      </div>
    </header>
  );
}
