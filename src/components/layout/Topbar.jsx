import React from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun, Search } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { ThemeMenu } from '../theme/ThemePicker';
import Wordmark from '../brand/Wordmark';

// Top bar on phones and tablets (the sidebar takes over on large screens).
// Just the logo, search and the theme; navigation lives in the bottom tab bar.
export default function Topbar() {
  const { theme } = useTheme();

  return (
    <header className="lg:hidden sticky top-0 z-20
                       aura-bar aura-bar-top
                       flex items-center justify-between px-4 h-14">
      <Link to="/" aria-label="Aura App home" className="flex items-center pt-1">
        <Wordmark className="text-3xl" />
      </Link>
      <div className="flex items-center gap-1">
        <Link to="/search" aria-label="Search"
          className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)] transition-all duration-200">
          <Search size={20} />
        </Link>
        <ThemeMenu buttonClassName="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)] transition-all duration-200">
          {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
        </ThemeMenu>
      </div>
    </header>
  );
}
