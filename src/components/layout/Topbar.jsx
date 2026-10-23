import React from 'react';
import { Moon, Sun, Sparkles } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function Topbar() {
  const { theme, toggleTheme } = useTheme();
  return (
    <header className="lg:hidden sticky top-0 z-20
                       bg-[var(--bg-secondary)]/90 backdrop-blur-md
                       border-b border-[var(--border)]
                       flex items-center justify-between px-4 h-14">
      <div className="flex items-center gap-2">
        <img
  src="/aura-logo.png"
  alt="Aura"
  className="w-7 h-7 rounded-lg"
/>
<span className="text-lg font-bold text-[var(--text-primary)]">Aura App</span>
      </div>
      <button onClick={toggleTheme}
        className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)] transition-all duration-200">
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </header>
  );
}