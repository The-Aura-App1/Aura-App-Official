import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Plus, Users, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useUnreadCount from '../../hooks/useUnreadCount';
import NotifyBell from './NotifyBell';
import Avatar from '../common/Avatar';
import { moreItems, isMorePath } from './navItems';

const tabClass = ({ isActive }) =>
  `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[11px] font-medium transition-all duration-200 ${
    isActive ? 'aura-tab-active' : 'text-[var(--text-muted)]'
  }`;

// The "Me" sheet: your profile, then everything that isn't a main tab.
function MeSheet({ onClose }) {
  const { dbProfile, displayName, username, logout } = useAuth();
  const navigate = useNavigate();
  const name = dbProfile?.displayName || displayName || username;
  const handle = dbProfile?.username || username;

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function signOut() {
    onClose();
    await logout();
    navigate('/welcome');
  }

  const row = 'flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[15px] font-medium text-[var(--text-primary)] active:bg-[var(--accent-subtle)] hover:bg-[var(--accent-subtle)]';
  return (
    <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
      <button aria-label="Close menu" onClick={onClose} className="aura-sheet-backdrop absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="aura-sheet absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl
                      bg-[var(--bg-secondary)] border-t border-[var(--border)] shadow-2xl
                      px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[var(--border)]" aria-hidden="true" />

        <Link to={`/profile/${encodeURIComponent(handle || '')}`} onClick={onClose}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-[var(--accent-subtle)]">
          <Avatar name={name} picKey={dbProfile?.profilePicKey} size="w-11 h-11" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[var(--text-primary)] truncate">{name}</p>
            <p className="text-xs text-[var(--text-muted)] truncate">View your profile</p>
          </div>
          <ChevronRight size={18} className="text-[var(--text-muted)]" />
        </Link>

        <div className="my-2 border-t border-[var(--border)]" />

        {moreItems(!!dbProfile?.isAdmin).map(({ to, icon: Icon, label }, i) => (
          <Link key={to} to={to} onClick={onClose} className={`${row} aura-arrive`} style={{ animationDelay: `${60 + i * 35}ms` }}>
            <Icon size={20} className="text-[var(--accent)]" /> {label}
          </Link>
        ))}

        <div className="my-2 border-t border-[var(--border)]" />
        <button onClick={signOut} className={`${row} w-full !text-red-400`}>
          <LogOut size={20} /> Sign out
        </button>
      </div>
    </div>
  );
}

// Phone tab bar: Feed, Groups, Post, Notifications, Me. Five at most, so it
// never crowds; everything else lives in the Me sheet.
export default function MobileNav() {
  const { pathname } = useLocation();
  const unreadCount = useUnreadCount();
  const { dbProfile, displayName, username } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const meActive = sheetOpen || isMorePath(pathname) || pathname.startsWith('/profile');

  // A page change closes the sheet
  useEffect(() => { setSheetOpen(false); }, [pathname]);

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40
                      aura-bar aura-bar-bottom
                      grid grid-cols-5 items-end px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <NavLink to="/" end className={tabClass} data-tour="nav-feed">
          {({ isActive }) => (<><Home size={22} strokeWidth={isActive ? 2.5 : 1.8} /><span>Feed</span></>)}
        </NavLink>
        <NavLink to="/groups" className={tabClass} data-tour="nav-groups">
          {({ isActive }) => (<><Users size={22} strokeWidth={isActive ? 2.5 : 1.8} /><span>Groups</span></>)}
        </NavLink>

        {/* Post: the one raised button */}
        <NavLink to="/create" aria-label="New post" data-tour="nav-post" className="flex flex-col items-center gap-0.5 pb-1">
          <span className="aura-fill w-12 h-12 -mt-5 rounded-2xl flex items-center justify-center text-white shadow-lg
                           ring-4 ring-[var(--bg-primary)] transition-transform duration-200 active:scale-90">
            <Plus size={26} strokeWidth={2.4} />
          </span>
        </NavLink>

        <NavLink to="/notifications" className={tabClass} aria-label="Notifications" data-tour="nav-notifications">
          <NotifyBell count={unreadCount} size={22} />
          <span>Alerts</span>
        </NavLink>

        <button onClick={() => setSheetOpen(true)} aria-haspopup="dialog" aria-expanded={sheetOpen} data-tour="nav-more"
          className={tabClass({ isActive: meActive })}>
          <span className={`rounded-full ${meActive ? 'ring-2 ring-[var(--accent)]' : ''}`}>
            <Avatar name={dbProfile?.displayName || displayName || username} picKey={dbProfile?.profilePicKey} size="w-6 h-6" />
          </span>
          <span>Me</span>
        </button>
      </nav>

      {sheetOpen && <MeSheet onClose={() => setSheetOpen(false)} />}
    </>
  );
}
