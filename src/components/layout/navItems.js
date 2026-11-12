import { Wallet, Settings, MessageSquareHeart, ShieldAlert, Info } from 'lucide-react';

// Everything outside the five main tabs. The sidebar shows these under
// "More"; phones show them in the "Me" sheet. Keep the main tabs to five so
// the phone bar never overflows; new pages go here.
export function moreItems(isAdmin) {
  return [
    { to: '/wallet',   icon: Wallet,             label: 'Aura Wallet' },
    { to: '/settings', icon: Settings,           label: 'Settings' },
    { to: '/feedback', icon: MessageSquareHeart, label: 'Suggestions & Reviews' },
    ...(isAdmin ? [{ to: '/moderation', icon: ShieldAlert, label: 'Moderation' }] : []),
    { to: '/about',    icon: Info,               label: 'About Aura' },
  ];
}

export function isMorePath(pathname) {
  return ['/wallet', '/settings', '/feedback', '/moderation'].some(p => pathname.startsWith(p));
}
