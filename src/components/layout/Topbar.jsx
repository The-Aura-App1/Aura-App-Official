import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Moon, Sun, Bell, User } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useUnreadCount from '../../hooks/useUnreadCount';

// Top bar on phones and tablets (the sidebar takes over on large screens).
export default function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const { displayName, username } = useAuth();
  const unreadCount = useUnreadCount();

  const iconClass = ({ isActive }) =>
    `relative p-2 rounded-xl transition-all duration-200 ${
      isActive
        ? 'text-aura-400 bg-aura-500/15'
        : 'text-[var(--text-muted)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)]'
    }`;

  return (
    <header className="lg:hidden sticky top-0 z-20
                       bg-[var(--bg-secondary)]/90 backdrop-blur-md
                       border-b border-[var(--border)]
                       flex items-center justify-between px-4 h-14">
      <Link to="/" className="flex items-center gap-2">
        <img src="/aura-logo.png" alt="Aura" className="w-8 h-8 rounded-lg" />
        <span className="aura-wordmark text-2xl">Aura App</span>
      </Link>
      <div className="flex items-center gap-1">
        <NavLink to="/notifications" aria-label="Notifications" className={iconClass}>
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-aura-500
                             text-white text-[9px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </NavLink>
        <NavLink to={`/profile/${username || displayName}`} aria-label="Profile" className={iconClass}>
          <User size={20} />
        </NavLink>
        <button onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)] transition-all duration-200">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </header>
  );
}
