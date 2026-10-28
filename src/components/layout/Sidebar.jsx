import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home, PlusSquare, Wallet, Settings,
  LogOut, Moon, Sun, User, Bell, Users, ShieldAlert
} from 'lucide-react';
import { useAuth }  from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ThemeMenu } from '../theme/ThemePicker';
import useUnreadCount from '../../hooks/useUnreadCount';

export default function Sidebar() {
  const { displayName, username, logout, dbProfile } = useAuth();
  const { theme, themeInfo }             = useTheme();
  const navigate                          = useNavigate();
  const unreadCount                       = useUnreadCount();

  const NAV = [
    { to: '/',                           icon: Home,       label: 'Feed'          },
    { to: '/notifications',              icon: Bell,       label: 'Notifications', badge: unreadCount },
    { to: '/groups',                     icon: Users,      label: 'Groups'        },
    { to: '/create',                     icon: PlusSquare, label: 'Post'          },
    { to: `/profile/${username || displayName}`, icon: User, label: 'Profile'    },
    { to: '/wallet',                     icon: Wallet,     label: 'Aura Wallet'  },
    { to: '/settings',                   icon: Settings,   label: 'Settings'     },
    ...(dbProfile?.isAdmin ? [{ to: '/moderation', icon: ShieldAlert, label: 'Moderation' }] : []),
  ];

  async function handleLogout() {
    await logout();
    navigate('/welcome');
  }

  return (
    <div className="flex flex-col h-full px-4 py-6">
      <div className="flex items-center gap-2 px-2 mb-10">
        <img src="/aura-logo.png" alt="Aura" className="w-9 h-9 rounded-xl" />
        <span className="aura-wordmark text-3xl">Aura App</span>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map(({ to, icon: Icon, label, badge }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
               transition-all duration-200 ${
                isActive
                  ? 'bg-aura-500/15 text-aura-400 font-semibold'
                  : 'text-[var(--text-muted)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)]'
              }`
            }>
            <div className="relative">
              <Icon size={20} />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5
                                 w-4 h-4 rounded-full bg-aura-500
                                 text-white text-[9px] font-bold
                                 flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </div>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-col gap-2 mt-auto">
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