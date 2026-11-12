import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, X, Users, User, Hash, Sparkles } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/post/PostCard';
import Avatar from '../components/common/Avatar';
import Reveal from '../components/motion/Reveal';
import { PostSkeleton } from '../components/motion/Skeleton';
import { JoinTypeBadge, GroupAvatar, memberCountText } from '../components/groups/GroupBits';
import { searchPosts, queryWords } from '../utils/searchRanking';
import { embedTexts } from '../utils/embedClient';
import { decodeVector } from '../utils/embeddings';
import { hashtagKey } from '../utils/hashtags';
import { EMPTY_TASTE, isLearningOn, loadTaste } from '../utils/tasteProfile';

const PAGE_SIZE   = 20;
const MAX_QUERY   = 80;
const USERNAME_RE = /^@?[a-z0-9_]{3,30}$/i;

// Waits until typing pauses before searching
function useDebounced(value, ms) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

// Runs load(q) for each new query and keeps only the latest answer
function useLatest(load, q, enabled) {
  const [state, setState] = useState({ q: '', data: null });
  useEffect(() => {
    if (!enabled) { setState({ q, data: null }); return undefined; }
    let live = true;
    load(q).then(data => live && setState({ q, data }), () => live && setState({ q, data: null }));
    return () => { live = false; };
  }, [load, q, enabled]);
  return state.q === q ? state.data : null;
}

const findPerson = q => api.getUser(q.replace(/^@/, '').toLowerCase()).catch(() => null);
const findGroups = q => api.listGroups(q).then(r => (r.groups ?? []).slice(0, 5));
// The query's meaning, from the on-device model; posts still match by words without it
const findMeaning = q => embedTexts([q], 20000).then(([vec]) => decodeVector(vec)).catch(() => null);

function SectionTitle({ icon: Icon, children }) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
      <Icon size={14} /> {children}
    </h2>
  );
}

function PersonRow({ person }) {
  return (
    <Link to={`/profile/${encodeURIComponent(person.username)}`}
      className="card flex items-center gap-3 hover:border-aura-500/40 transition-colors">
      <Avatar name={person.displayName || person.username} picKey={person.profilePicKey} size="w-10 h-10" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{person.displayName || person.username}</p>
        <p className="text-xs text-[var(--text-muted)] truncate">@{person.username}</p>
      </div>
    </Link>
  );
}

function GroupRow({ group }) {
  const count = memberCountText(group);
  return (
    <Link to={`/groups/${encodeURIComponent(group.groupId)}`}
      className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 group">
      <GroupAvatar name={group.name} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-aura-400 truncate">{group.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <JoinTypeBadge joinType={group.joinType} />
          {count && <span className="text-xs text-[var(--text-muted)]">{count}</span>}
        </div>
      </div>
    </Link>
  );
}

// The most used hashtags among posts going around right now, as starting points
function popularHashtags(posts, limit = 12) {
  const counts = new Map();
  for (const post of posts) {
    for (const tag of post.hashtags ?? []) {
      const key = hashtagKey(tag);
      const entry = counts.get(key) ?? { tag, count: 0 };
      entry.count++;
      counts.set(key, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit).map(e => e.tag);
}

export default function Search() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [text, setText]     = useState(() => (params.get('q') ?? '').slice(0, MAX_QUERY));
  const [pool, setPool]     = useState(null);
  const [poolError, setPoolError] = useState('');
  const [shown, setShown]   = useState(PAGE_SIZE);
  const [taste] = useState(() => (user?.userId && isLearningOn(user.userId) ? loadTaste(user.userId) : EMPTY_TASTE));
  const inputRef = useRef(null);

  const q = useDebounced(text.trim(), 300);
  const hasWords = queryWords(q).length > 0;

  // Keep ?q= in the address so a search can be shared or come back to
  useEffect(() => {
    if ((params.get('q') ?? '') !== q) setParams(q ? { q } : {}, { replace: true });
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setShown(PAGE_SIZE); }, [q]);

  // The same posts the feed draws from; matching happens on this device
  function loadPool() {
    api.getFeed().then(data => setPool(data.posts ?? []), err => setPoolError(err.message));
  }
  useEffect(loadPool, []);

  const person  = useLatest(findPerson, q, USERNAME_RE.test(q));
  const groups  = useLatest(findGroups, q, q.length >= 2);
  const meaning = useLatest(findMeaning, q, hasWords);

  const results = useMemo(
    () => (pool && hasWords ? searchPosts(pool, q, meaning, taste) : []),
    [pool, q, hasWords, meaning, taste],
  );
  const hashtags = useMemo(() => popularHashtags(pool ?? []), [pool]);

  function pick(value) {
    setText(value);
    inputRef.current?.focus();
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex flex-col gap-5 pb-10">
      <form role="search" onSubmit={e => { e.preventDefault(); inputRef.current?.blur(); }} className="relative">
        <SearchIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          autoFocus
          enterKeyHint="search"
          value={text}
          maxLength={MAX_QUERY}
          onChange={e => setText(e.target.value)}
          placeholder="Search posts, people and groups"
          aria-label="Search"
          className="input pl-10 pr-10 py-3 text-base"
        />
        {text && (
          <button type="button" onClick={() => pick('')} aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={16} />
          </button>
        )}
      </form>

      {!q && (
        <section className="flex flex-col gap-3">
          {hashtags.length > 0 && (
            <>
              <SectionTitle icon={Hash}>Popular right now</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {hashtags.map(tag => (
                  <button key={tag} type="button" onClick={() => pick(tag)}
                    className="px-3 py-1.5 rounded-full text-sm border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-aura-500/40 hover:text-[var(--text-primary)] transition-colors">
                    #{tag}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="text-xs text-[var(--text-muted)]">
            Posts are matched on your device by their words and meaning, then ordered by aura and how recent they are.
            Your searches aren't saved.
          </p>
        </section>
      )}

      {person && (
        <section className="flex flex-col gap-2">
          <SectionTitle icon={User}>Person</SectionTitle>
          <PersonRow person={person} />
        </section>
      )}

      {groups?.length > 0 && (
        <section className="card flex flex-col gap-3">
          <SectionTitle icon={Users}>Groups</SectionTitle>
          <div className="flex flex-col">
            {groups.map(group => <GroupRow key={group.groupId} group={group} />)}
          </div>
        </section>
      )}

      {q && hasWords && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle icon={Sparkles}>Posts</SectionTitle>
            {pool && <span className="text-xs text-[var(--text-muted)]">
              {results.length === 1 ? '1 match' : `${results.length} matches`}
            </span>}
          </div>

          {poolError && <p className="text-sm text-red-400">{poolError}</p>}
          {!pool && !poolError && <PostSkeleton />}

          {pool && !results.length && (
            <div className="card text-center py-10">
              <p className="text-[var(--text-primary)] font-semibold">No posts match “{q}”</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">Try fewer words, or a hashtag.</p>
            </div>
          )}

          {results.slice(0, shown).map((post, i) => (
            <Reveal key={post.postId} delay={i < 4 ? i * 60 : 0} className="aura-offscreen">
              <PostCard post={post} onUpdate={loadPool} />
            </Reveal>
          ))}

          {shown < results.length && (
            <button type="button" onClick={() => setShown(n => n + PAGE_SIZE)} className="btn-secondary self-center px-5 py-2">
              Show more
            </button>
          )}
        </section>
      )}
    </div>
  );
}
