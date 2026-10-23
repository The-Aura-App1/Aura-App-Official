import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Grid, Heart, TrendingUp, Camera, Edit3,
  Save, X, Plus, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import PostCard from '../components/post/PostCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatAura, timeAgo } from '../utils/format';
import AuraTimelineGraph from '../components/profile/AuraTimelineGraph';
import { updateUserAttributes } from 'aws-amplify/auth';

const S3_URL = 'https://aura-app-media-570934198135.s3.amazonaws.com';

const BADGES = {
  first_100:       { emoji: '🌟', label: 'First 100 Users'  },
  first_1000:      { emoji: '💫', label: 'First 1,000 Users' },
  month_1:         { emoji: '💜', label: '1 Month Member'   },
  year_1:          { emoji: '👑', label: '1 Year Member'    },
  aura_10k:        { emoji: '💵', label: '10K Aura Earned'  },
  aura_100k:       { emoji: '🤑', label: '100K Aura Earned' },
  aura_1m:         { emoji: '💰', label: '1M Aura Earned'   },
  big_spender:     { emoji: '😇', label: 'Big Spender'      },
  premium:         { emoji: '⚡', label: 'Premium Member'   },
  verified_creator:{ emoji: '✓', label: 'Verified Creator', purple: true },
};

export function VerifiedBadge({ size = 16 }) {
  return (
    <span style={{ fontSize: size, color: '#7c3aed', fontWeight: 900 }} title="Verified Creator">
      ✓
    </span>
  );
}

const SUGGESTED_TAGS = [
  'photography','art','music','filmmaker','design','writer','poetry',
  'gaming','comedy','sports','fitness','cooking','travel','fashion',
  'tech','science','finance','coding','books','education',
  'entrepreneur','student','pets','motivation','sustainability',
  'outdoors','cars','food','beauty','DIY',
];

export default function Profile() {
  const { username }   = useParams();
  const { user, displayName, isPremium, isCreator, refreshUser } = useAuth();
  const navigate       = useNavigate();

  const [profile, setProfile]     = useState(null);
  const [posts, setPosts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [activeTab, setActiveTab] = useState('posts');
  const [isOwner, setIsOwner]     = useState(false);
  const [editing, setEditing]     = useState(false);

  // Edit state
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername]       = useState('');
  const [editBio, setEditBio]                 = useState('');
  const [editTags, setEditTags]               = useState([]);
  const [tagInput, setTagInput]               = useState('');
  const [avatarFile, setAvatarFile]           = useState(null);
  const [avatarPreview, setAvatarPreview]     = useState(null);
  const [bannerFile, setBannerFile]           = useState(null);
  const [bannerPreview, setBannerPreview]     = useState(null);
  const [saving, setSaving]                   = useState(false);
  const [saveError, setSaveError]             = useState('');

  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const profileUsername = username ?? displayName;

  useEffect(() => { loadProfile(); }, [profileUsername]);

  useEffect(() => {
    if (profile?.userId) loadPosts(profile.userId);
  }, [profile]);

  async function loadProfile() {
    try {
      setLoading(true);
      const data = await api.getUser(profileUsername);
      setProfile(data);
      const mine = data.userId === user?.userId;
      setIsOwner(mine);
      if (mine) {
        setEditDisplayName(data.displayName ?? '');
        setEditUsername(data.username ?? '');
        setEditBio(data.bio ?? '');
        setEditTags(data.tags ?? []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPosts(userId) {
    try {
      const data = await api.getUserPosts(userId);
      setPosts(data.posts ?? []);
    } catch (err) {
      console.error('Failed to load posts:', err);
    }
  }

  function handleAvatarSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleBannerSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  }

  function addTag(tag) {
    const clean = tag.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean || editTags.includes(clean) || editTags.length >= 10) return;
    setEditTags(prev => [...prev, clean]);
    setTagInput('');
  }

  function removeTag(tag) {
    setEditTags(prev => prev.filter(t => t !== tag));
  }

  function cancelEdit() {
    setEditing(false);
    setAvatarFile(null);
    setAvatarPreview(null);
    setBannerFile(null);
    setBannerPreview(null);
    setSaveError('');
    if (profile) {
      setEditDisplayName(profile.displayName ?? '');
      setEditUsername(profile.username ?? '');
      setEditBio(profile.bio ?? '');
      setEditTags(profile.tags ?? []);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');

    try {
      let profilePicKey = profile.profilePicKey;
      let bannerKey     = profile.bannerKey;

      // Upload avatar if changed
      if (avatarFile) {
        const { urls } = await api.getProfileUploadUrls([
          { name: avatarFile.name, contentType: avatarFile.type, type: 'avatar' }
        ]);
        await fetch(urls[0].url, {
          method: 'PUT', body: avatarFile,
          headers: { 'Content-Type': avatarFile.type },
        });
        profilePicKey = urls[0].key;
      }

      // Upload banner if changed
      if (bannerFile) {
        const { urls } = await api.getProfileUploadUrls([
          { name: bannerFile.name, contentType: bannerFile.type, type: 'banner' }
        ]);
        await fetch(urls[0].url, {
          method: 'PUT', body: bannerFile,
          headers: { 'Content-Type': bannerFile.type },
        });
        bannerKey = urls[0].key;
      }

      // Save all profile fields together
      const updated = await api.updateProfile({
        displayName:  editDisplayName.trim(),
        username:     editUsername.trim().toLowerCase(),
        bio:          editBio.trim(),
        tags:         editTags,
        profilePicKey,
        bannerKey,
      });

      await api.fixAuthorNames(
        editUsername.trim().toLowerCase(),
        editDisplayName.trim(),
        profilePicKey
      );

      // Sync Cognito attributes
      await updateUserAttributes({
        userAttributes: {
          'custom:displayName': editDisplayName.trim(),
          'preferred_username': editUsername.trim().toLowerCase(),
        }
      });

      setProfile(updated);
      await refreshUser();
      setEditing(false);
      setAvatarFile(null);
      setBannerFile(null);
      setAvatarPreview(null);
      setBannerPreview(null);

      // Update URL if username changed
      if (editUsername !== profile.username) {
        navigate(`/profile/${editUsername}`, { replace: true });
      }
      
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (error)   return (
    <div className="flex items-center justify-center py-20">
      <p className="text-red-400 text-sm">{error}</p>
    </div>
  );
  if (!profile) return null;

  const badges = profile.badges ?? [];

  return (
    <div className="flex flex-col min-h-screen pb-8">

      {/* ── Banner ── */}
      <div className="relative w-full h-36 sm:h-48 overflow-hidden">
        {bannerPreview || profile.bannerKey ? (
          <img
            src={bannerPreview ?? `${S3_URL}/${profile.bannerKey}`}
            alt="Banner"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full"
            style={{ background: 'linear-gradient(135deg, #1a0a2e 0%, #3d2470 50%, #1a0a2e 100%)' }} />
        )}
        {editing && (
          <button
            onClick={() => bannerInputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center
                       bg-black/40 backdrop-blur-sm text-white gap-2 text-sm font-medium
                       hover:bg-black/60 transition-all">
            <Camera size={20} /> Change Banner
          </button>
        )}
        <input ref={bannerInputRef} type="file" accept="image/*"
          onChange={handleBannerSelect} className="hidden" />
      </div>

      {/* ── Profile header ── */}
      <div className="px-4 pb-4">
        <div className="flex items-end justify-between -mt-14 sm:-mt-16 mb-4">

          {/* Avatar */}
          <div className="relative">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full
                            border-4 border-[var(--bg-primary)]
                            bg-aura-500/20 overflow-hidden flex-shrink-0">
              {avatarPreview || profile.profilePicKey ? (
                <img
                  src={avatarPreview ?? `${S3_URL}/${profile.profilePicKey}`}
                  alt={profile.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-aura-500/20">
                  <span className="text-aura-400 text-3xl font-bold">
                    {profile.displayName?.[0]?.toUpperCase() ?? '?'}
                  </span>
                </div>
              )}
            </div>
            {editing && (
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 rounded-full flex items-center justify-center
                           bg-black/50 text-white hover:bg-black/70 transition-all">
                <Camera size={18} />
              </button>
            )}
            <input ref={avatarInputRef} type="file" accept="image/*"
              onChange={handleAvatarSelect} className="hidden" />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-16">
            {isOwner ? (
              editing ? (
                <div className="flex gap-2">
                  <button onClick={cancelEdit}
                    className="btn-secondary flex items-center gap-2 text-sm px-4 py-2">
                    <X size={15} /> Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="btn-primary flex items-center gap-2 text-sm px-4 py-2">
                    <Save size={15} />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditing(true)}
                  className="btn-secondary flex items-center gap-2 text-sm px-4 py-2">
                  <Edit3 size={15} /> Edit Profile
                </button>
              )
            ) : (
              <button className="btn-primary text-sm px-5 py-2">Follow</button>
            )}
          </div>
        </div>

        {/* Save error */}
        {saveError && (
          <div className="mb-3 px-4 py-2.5 rounded-xl bg-red-400/10
                          border border-red-400/20 text-red-400 text-sm">
            {saveError}
          </div>
        )}

        {/* ── Display name + verified ── */}
        {editing ? (
          <input
            value={editDisplayName}
            onChange={e => setEditDisplayName(e.target.value)}
            placeholder="Display name"
            maxLength={50}
            className="input text-lg font-bold mb-2"
          />
        ) : (
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              {profile.displayName}
            </h1>
            {profile.isCreator && <VerifiedBadge size={18} />}
          </div>
        )}

        {/* ── Username ── */}
        {editing ? (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[var(--text-muted)] text-sm">@</span>
            <input
              value={editUsername}
              onChange={e => setEditUsername(e.target.value)}
              placeholder="username"
              maxLength={30}
              className="input text-sm py-1.5"
            />
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)] mb-2">@{profile.username}</p>
        )}

        {/* ── Aura rank ── */}
        {profile.auraRank && !profile.hideAuraRank && (
          <p className="text-xs text-aura-400 font-medium mb-2">
            #{profile.auraRank.toLocaleString()} Global Rank
          </p>
        )}

        {/* ── Bio ── */}
        {editing ? (
          <div className="mb-3">
            <textarea
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              placeholder="Write a bio..."
              rows={3}
              maxLength={160}
              className="input resize-none text-sm"
            />
            <p className="text-xs text-[var(--text-muted)] text-right mt-1">
              {editBio.length} / 160
            </p>
          </div>
        ) : profile.bio ? (
          <p className="text-sm text-[var(--text-primary)] mb-3 leading-relaxed">
            {profile.bio}
          </p>
        ) : null}

        {/* ── Stats ── */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <div className="text-center">
            <p className="font-bold text-[var(--text-primary)]">{posts.length}</p>
            <p className="text-[var(--text-muted)] text-xs">Posts</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-[var(--text-primary)]">
              {formatAura(profile.auraBalance ?? 0)}
            </p>
            <p className="text-[var(--text-muted)] text-xs">Aura</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-[var(--text-primary)]">
              {profile.mutualFollowers ?? 0}
            </p>
            <p className="text-[var(--text-muted)] text-xs">Mutuals</p>
          </div>
        </div>

        {/* ── Tags ── */}
        {editing ? (
          <div className="mb-4">
            <p className="text-xs text-[var(--text-muted)] mb-2 font-medium">
              Tags ({editTags.length}/10)
            </p>
            {/* Current tags */}
            <div className="flex flex-wrap gap-2 mb-2">
              {editTags.map(tag => (
                <span key={tag}
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-xs
                             bg-aura-500/15 border border-aura-500/30 text-aura-400">
                  #{tag}
                  <button onClick={() => removeTag(tag)}
                    className="hover:text-red-400 transition-colors ml-1">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            {/* Tag input */}
            {editTags.length < 10 && (
              <div className="flex gap-2 mb-2">
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
                  placeholder="Add a tag..."
                  maxLength={30}
                  className="input text-sm py-1.5 flex-1"
                />
                <button onClick={() => addTag(tagInput)}
                  className="btn-primary text-sm px-3 py-1.5">
                  <Plus size={14} />
                </button>
              </div>
            )}
            {/* Suggested tags */}
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.filter(t => !editTags.includes(t)).slice(0, 12).map(tag => (
                <button key={tag} onClick={() => addTag(tag)}
                  className="px-2.5 py-1 rounded-full text-xs
                             bg-[var(--bg-elevated)] border border-[var(--border)]
                             text-[var(--text-muted)] hover:border-aura-500/50
                             hover:text-aura-400 transition-all">
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        ) : (profile.tags ?? []).length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-4">
            {profile.tags.map(tag => (
              <span key={tag}
                className="px-3 py-1 rounded-full text-xs
                           bg-aura-500/10 border border-aura-500/20 text-aura-400">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        {/* ── Badges ── */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {badges.map((badge, i) => {
              const def = BADGES[badge];
              if (!def) return null;
              return (
                <div key={i}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                             bg-aura-500/10 border border-aura-500/20
                             text-xs font-medium text-[var(--text-primary)]">
                  <span>{def.emoji}</span>
                  <span>{def.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="border-t border-[var(--border)] flex">
        {[
          { key: 'posts',    icon: Grid,        label: 'Posts'    },
          { key: 'timeline', icon: TrendingUp,  label: 'Aura'     },
          ...(isOwner ? [{ key: 'liked', icon: Heart, label: 'Liked' }] : []),
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2
                        py-3 text-sm font-medium border-b-2 transition-all
              ${activeTab === tab.key
                ? 'border-aura-500 text-aura-400'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}>
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 px-4 pt-4">
        {activeTab === 'posts' && (
          <div className="flex flex-col gap-4">
            {posts.length === 0 ? (
              <p className="text-center text-[var(--text-muted)] text-sm py-10">
                No posts yet.
              </p>
            ) : posts.map(post => (
              <PostCard key={post.postId} post={post} />
            ))}
          </div>
        )}
        {activeTab === 'timeline' && (
          <AuraTimelineGraph userId={profile.userId} />
        )}
        {activeTab === 'liked' && isOwner && (
          <p className="text-center text-[var(--text-muted)] text-sm py-10">
            Posts you like will appear here.
          </p>
        )}
      </div>
    </div>
  );
}