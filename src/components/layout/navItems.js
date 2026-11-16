import { Wallet, Settings, MessageSquareHeart, ShieldAlert, Info, Compass, Sparkles, Crown } from 'lucide-react';

// Everything outside the five main tabs. The sidebar shows these under
// "More"; phones show them in the "Me" sheet. Keep the main tabs to five so
// the phone bar never overflows; new pages go here.
export function moreItems(isAdmin) {
  return [
    { to: '/angel',    icon: Sparkles,           label: 'Angel' },
    { to: '/wallet',   icon: Wallet,             label: 'Aura Wallet' },
    { to: '/premium',  icon: Crown,              label: 'Premium' },
    { to: '/settings', icon: Settings,           label: 'Settings' },
    { to: '/feedback', icon: MessageSquareHeart, label: 'Suggestions & Reviews' },
    ...(isAdmin ? [{ to: '/moderation', icon: ShieldAlert, label: 'Moderation' }] : []),
    { to: '/?tour=1',  icon: Compass,            label: 'App tour' },
    { to: '/about',    icon: Info,               label: 'About Aura' },
  ];
}

export function isMorePath(pathname) {
  return ['/angel', '/wallet', '/premium', '/settings', '/feedback', '/moderation'].some(p => pathname.startsWith(p));
}
