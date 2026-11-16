import React, { useState } from 'react';
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

const MEDIA_URL = 'https://aura-app-media-570934198135.s3.amazonaws.com/';

// The group's picture (a level-2 perk), or its first letter
export function GroupAvatar({ name, picKey, size = 'md' }) {
  const [broken, setBroken] = useState(false);
  const sizes = { xs: 'w-8 h-8 text-sm', sm: 'w-10 h-10 text-base', md: 'w-12 h-12 text-lg', lg: 'w-16 h-16 text-2xl' };
  return (
    <div className={`${sizes[size]} rounded-2xl bg-aura-500/15 border border-aura-500/30 flex-shrink-0 overflow-hidden
                     flex items-center justify-center font-bold text-aura-400`}>
      {picKey && !broken
        ? <img src={MEDIA_URL + picKey} alt="" className="w-full h-full object-cover" onError={() => setBroken(true)} />
        : name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

export function memberCountText(group) {
  if (group.memberCount === undefined) return null;
  return `${group.memberCount.toLocaleString()} member${group.memberCount === 1 ? '' : 's'}`;
}
