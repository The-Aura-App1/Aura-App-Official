import React from 'react';
import { Globe, Lock, Mail } from 'lucide-react';

export const JOIN_TYPES = {
  open:    { label: 'Public',          icon: Globe, hint: 'Anyone can join and read posts.' },
  request: { label: 'Request to join', icon: Lock,  hint: 'People ask to join; owners and mods approve. Only members see posts.' },
  invite:  { label: 'Invite only',     icon: Mail,  hint: 'Hidden from browsing. Owners and mods invite by username.' },
};

export function JoinTypeBadge({ joinType }) {
  const type = JOIN_TYPES[joinType] ?? JOIN_TYPES.open;
  const Icon = type.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                     bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)]">
      <Icon size={12} /> {type.label}
    </span>
  );
}

export function GroupAvatar({ name, size = 'md' }) {
  const sizes = { sm: 'w-10 h-10 text-base', md: 'w-12 h-12 text-lg', lg: 'w-16 h-16 text-2xl' };
  return (
    <div className={`${sizes[size]} rounded-2xl bg-aura-500/15 border border-aura-500/30 flex-shrink-0
                     flex items-center justify-center font-bold text-aura-400`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

export function memberCountText(group) {
  if (group.memberCount === undefined) return null;
  return `${group.memberCount.toLocaleString()} member${group.memberCount === 1 ? '' : 's'}`;
}
