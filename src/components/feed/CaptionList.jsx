import React from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon, Video, AlignLeft, MessageCircle, Sparkles, Search, X, LayoutList, Rows3 } from 'lucide-react';
import Avatar from '../common/Avatar';
import { timeAgo } from '../../utils/format';
import { fold, queryWords } from '../../utils/searchRanking';

// The feed's two looks: full posts, or Reddit-style captions first (tap one to
// open the post). The choice is remembered on this device only.
const VIEW_KEY = 'aura.feedView';
export const VIEWS = ['posts', 'captions'];

export function loadView() {
  try { return localStorage.getItem(VIEW_KEY) === 'captions' ? 'captions' : 'posts'; } catch { return 'posts'; }
}

export function saveView(view) {
  try { localStorage.setItem(VIEW_KEY, view); } catch { /* private window: just not remembered */ }
}

const wordsOf = text => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

// Whether every typed word starts a word of the caption or one of its
// hashtags ("sun" finds "Sunset over the ridge"). Nothing typed matches all.
export function captionMatches(post, query) {
  const wanted = queryWords(query);
  if (!wanted.length) return true;
  const have = [...wordsOf(post.caption), ...(post.hashtags ?? []).flatMap(wordsOf)];
  return wanted.every(w => have.some(h => h.startsWith(w)));
}

const KIND = {
  image: { Icon: ImageIcon, label: 'Photo' },
  video: { Icon: Video,     label: 'Video' },
  text:  { Icon: AlignLeft, label: 'Text'  },
};

export function ViewSwitch({ view, onChange }) {
  const options = [
    { id: 'posts',    label: 'Posts',    Icon: Rows3 },
    { id: 'captions', label: 'Captions', Icon: LayoutList },
  ];
  return (
    <div role="radiogroup" aria-label="Feed view"
      className="inline-flex p-0.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex-shrink-0">
      {options.map(({ id, label, Icon }) => (
        <button key={id} type="button" role="radio" aria-checked={view === id} onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-colors
            ${view === id ? 'bg-aura-500/20 text-aura-400' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
          <Icon size={14} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

export function CaptionFilter({ value, onChange }) {
  return (
    <label className="relative flex-1 min-w-0">
      <span className="sr-only">Filter by caption</span>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" aria-hidden="true" />
      <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder="Filter by caption"
        className="input w-full pl-9 pr-9 py-2 text-sm" maxLength={100} />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear filter"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <X size={14} />
        </button>
      )}
    </label>
  );
}

// One post as a caption row. The whole row opens the post; the author's name
// opens their profile.
export function CaptionRow({ post }) {
  const kind = KIND[post.type] ?? KIND.text;
  const caption = (post.caption ?? '').trim();
  const profile = `/profile/${encodeURIComponent(post.authorUsername ?? '')}`;
  return (
    <article className="card relative p-4 flex flex-col gap-2 hover:border-aura-500/30 transition-colors">
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] min-w-0">
        <Link to={profile} className="relative z-10 flex items-center gap-2 min-w-0 hover:text-aura-400">
          <Avatar name={post.authorDisplay} picKey={post.authorPicKey} size="w-6 h-6" />
          <span className="font-semibold text-[var(--text-secondary)] truncate">{post.authorDisplay}</span>
        </Link>
        <span aria-hidden="true">·</span>
        <span className="flex-shrink-0">{timeAgo(post.createdAt)}</span>
        <span className="ml-auto flex items-center gap-1 flex-shrink-0 px-2 py-0.5 rounded-full bg-[var(--bg-elevated)]">
          <kind.Icon size={12} aria-hidden="true" />{kind.label}
        </span>
      </div>

      <Link to={`/post/${encodeURIComponent(post.postId)}`}
        className="after:absolute after:inset-0 after:content-[''] after:rounded-[inherit] focus-visible:outline-none">
        <h2 className={`text-[15px] leading-snug line-clamp-3 break-words whitespace-pre-line
          ${caption ? 'font-semibold text-[var(--text-primary)]' : 'italic text-[var(--text-muted)]'}`}>
          {caption || `${kind.label} post with no caption`}
        </h2>
      </Link>

      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1"><Sparkles size={13} className="text-aura-400" aria-hidden="true" />{post.auraScore ?? 0}<span className="sr-only"> aura</span></span>
        <span className="flex items-center gap-1"><MessageCircle size={13} aria-hidden="true" />{post.commentCount ?? 0}<span className="sr-only"> comments</span></span>
        {(post.hashtags ?? []).slice(0, 3).map(tag => (
          <span key={tag} className="text-aura-400/80 truncate">#{tag}</span>
        ))}
      </div>
    </article>
  );
}
