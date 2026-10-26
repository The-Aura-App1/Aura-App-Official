import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart, MessageCircle, Share2, MoreHorizontal,
  ChevronLeft, ChevronRight, Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api }     from '../../api';
import AuraModal   from './AuraModal';
import PostMedia   from './PostMedia';
import { formatAura, timeAgo } from '../../utils/format';
import { topicLabel } from '../../utils/topics';

// onRemove, when given, adds Delete/Remove to the ⋯ menu (own profile, and group moderation).
// onPrefer(post, 'more' | 'less'), when given, adds "more/less like this" for tagged posts.
export default function PostCard({ post, onUpdate, onRemove, onPrefer }) {
  const { user }  = useAuth();
  const isOwner   = user?.userId === post.authorId;
  const tags      = post.tags ?? [];
  const hashtags  = post.hashtags ?? [];
  const canPrefer = !!onPrefer && tags.length > 0;
  const [menuOpen, setMenuOpen]           = useState(false);
  const [preferred, setPreferred]         = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving]           = useState(false);
  const [removeError, setRemoveError]     = useState('');

  async function handleRemove() {
    if (!confirmRemove) { setConfirmRemove(true); return; }
    setRemoving(true);
    setRemoveError('');
    try {
      await onRemove(post);
      setMenuOpen(false);
    } catch (err) {
      setRemoveError(err.message || 'Could not delete post.');
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  }

  const [showAuraModal, setShowAuraModal] = useState(false);
  const [auraType, setAuraType]           = useState('give');
  const [auraScore, setAuraScore]         = useState(post.auraScore ?? 0);
  const [liked, setLiked]                 = useState(!!post.likedByMe);
  // Only the author receives likeCount from the API
  const [likeCount, setLikeCount]         = useState(post.likeCount);
  const [liking, setLiking]               = useState(false);

  // Updates immediately and rolls back if the request fails
  async function handleLike() {
    if (liking) return;
    const next = !liked;
    setLiking(true);
    setLiked(next);
    if (likeCount !== undefined) setLikeCount(c => c + (next ? 1 : -1));
    try {
      await (next ? api.likePost(post.postId) : api.unlikePost(post.postId));
    } catch (err) {
      console.error(err);
      setLiked(!next);
      if (likeCount !== undefined) setLikeCount(c => c + (next ? -1 : 1));
    } finally {
      setLiking(false);
    }
  }

  function openAura(type) {
    setAuraType(type);
    setShowAuraModal(true);
  }

  function handleAuraSuccess(delta) {
    setAuraScore(prev => prev + delta);
    setShowAuraModal(false);
  }

  return (
    <>
      <article className="card p-0 overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            to={`/profile/${post.authorUsername}`}
            className="flex items-center gap-3"
          >
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-aura-500/20 border border-aura-500/30
                overflow-hidden flex-shrink-0">
                {post.authorPicKey ? (
                  <img
                    src={`https://aura-app-media-570934198135.s3.amazonaws.com/${post.authorPicKey}`}
                    alt={post.authorDisplay}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-aura-400 text-sm font-bold">
                      {post.authorDisplay?.[0]?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                )}
              </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]
                            hover:text-aura-400 transition-colors">
                {post.authorDisplay}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {timeAgo(post.createdAt)}
              </p>
            </div>
          </Link>

          <div className="relative">
            <button
              onClick={() => { setMenuOpen(o => !o); setConfirmRemove(false); setRemoveError(''); }}
              aria-label="More options"
              aria-expanded={menuOpen}
              className="p-2 rounded-lg text-[var(--text-muted)]
                         hover:bg-[var(--accent-subtle)]
                         hover:text-[var(--accent)]
                         transition-all duration-200">
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (onRemove || canPrefer) && (
              <div className="absolute right-0 top-full mt-1 z-20 min-w-[11rem] rounded-xl
                              bg-[var(--bg-secondary)] border border-[var(--border)] shadow-lg p-1">
                {canPrefer && (preferred ? (
                  <p className="px-3 py-2 text-xs text-[var(--text-muted)] max-w-[14rem]">
                    Got it, you'll see {preferred} posts like this next time you open your feed.
                  </p>
                ) : (
                  <>
                    <button
                      onClick={() => { onPrefer(post, 'more'); setPreferred('more'); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-[var(--text-primary)]
                                 hover:bg-[var(--accent-subtle)]">
                      Show more like this
                    </button>
                    <button
                      onClick={() => { onPrefer(post, 'less'); setPreferred('fewer'); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-[var(--text-primary)]
                                 hover:bg-[var(--accent-subtle)]">
                      Show less like this
                    </button>
                  </>
                ))}
                {onRemove && <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-400
                             hover:bg-red-400/10 disabled:opacity-50">
                  {removing ? 'Deleting...' : confirmRemove ? 'Tap again to delete' : isOwner ? 'Delete post' : 'Remove post'}
                </button>}
                {removeError && <p className="px-3 py-1 text-xs text-red-400">{removeError}</p>}
              </div>
            )}
          </div>
        </div>

        {/* ── Media ── */}
        {post.type !== 'text' && (
          <PostMedia post={post} />
        )}

        {/* ── Text post content ── */}
        {post.type === 'text' && post.caption && (
          <div className="px-4 py-3">
            <p className="text-[var(--text-primary)] text-sm leading-relaxed whitespace-pre-wrap">
              {post.caption}
            </p>
          </div>
        )}

        {/* ── Action bar ── */}
        <div className="px-4 py-2 flex items-center justify-between">

          {/* Left — Aura buttons */}
          <div className="flex items-center gap-2">
            {/* Give Aura */}
            <button
              onClick={() => openAura('give')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                         bg-aura-500/10 hover:bg-aura-500/20
                         border border-aura-500/20 hover:border-aura-500/40
                         text-aura-400 text-xs font-semibold
                         transition-all duration-200"
            >
              <Sparkles size={13} />
              Give
            </button>

            {/* Aura score */}
            <span className={`text-sm font-bold tabular-nums
              ${auraScore > 0 ? 'text-aura-400' :
                auraScore < 0 ? 'text-red-400' :
                'text-[var(--text-muted)]'}`}>
              {formatAura(auraScore)}
            </span>

            {/* Take Aura */}
            <button
              onClick={() => openAura('take')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                         bg-red-500/10 hover:bg-red-500/20
                         border border-red-500/20 hover:border-red-500/40
                         text-red-400 text-xs font-semibold
                         transition-all duration-200"
            >
              Take
            </button>
          </div>

          {/* Right — Like, Comment, Share */}
          <div className="flex items-center gap-1">
            {/* Like */}
            <button
              onClick={handleLike}
              disabled={liking}
              aria-pressed={liked}
              aria-label={liked ? 'Unlike' : 'Like'}
              className={`flex items-center gap-1 p-2 rounded-lg transition-all duration-200
                ${liked
                  ? 'text-red-400'
                  : 'text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10'
                }`}
            >
              <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
              {likeCount !== undefined && (
                <span className="text-xs font-semibold">{likeCount}</span>
              )}
            </button>

            {/* Comment */}
            <Link
              to={`/post/${post.postId}`}
              className="p-2 rounded-lg text-[var(--text-muted)]
                         hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)]
                         transition-all duration-200"
            >
              <MessageCircle size={20} />
            </Link>

            {/* Share */}
            <button
              className="p-2 rounded-lg text-[var(--text-muted)]
                         hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)]
                         transition-all duration-200"
            >
              <Share2 size={20} />
            </button>
          </div>
        </div>

        {/* ── Caption (for image/video posts) ── */}
        {post.type !== 'text' && post.caption && (
          <div className="px-4 pb-2">
            <p className="text-sm text-[var(--text-primary)]">
              <span className="font-semibold mr-1">{post.authorUsername}</span>
              {post.caption}
            </p>
          </div>
        )}

        {(tags.length > 0 || hashtags.length > 0) && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <span key={tag} className="text-xs text-aura-400/80">#{topicLabel(tag)}</span>
            ))}
            {hashtags.map(tag => (
              <span key={`h-${tag}`} className="text-xs text-aura-400/80">#{tag}</span>
            ))}
          </div>
        )}

        {/* ── Comment count ── */}
        {post.commentCount > 0 && (
          <Link
            to={`/post/${post.postId}`}
            className="block px-4 pb-3 text-xs text-[var(--text-muted)]
                       hover:text-[var(--accent)] transition-colors"
          >
            View all {post.commentCount} comments
          </Link>
        )}

      </article>

      {/* ── Aura Modal ── */}
      {showAuraModal && (
        <AuraModal
          post={post}
          type={auraType}
          onSuccess={handleAuraSuccess}
          onClose={() => setShowAuraModal(false)}
        />
      )}
    </>
  );
}