import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Image, Video, Type, X, Upload, Sparkles, Users } from 'lucide-react';
import { api } from '../api';
import { TOPICS, MAX_POST_TOPICS, topicLabel } from '../utils/topics';
import { postEmbeddingText } from '../utils/embeddings';
import { addHashtags, MAX_HASHTAGS } from '../utils/hashtags';
import { embedTexts, warmUpModel } from '../utils/embedClient';

const EMBED_TIMEOUT_MS = 15000;

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;  // 20MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB

export default function CreatePost() {
  const navigate = useNavigate();
  // ?group=<id> posts into that group instead of the main feed
  const [searchParams] = useSearchParams();
  const groupId  = searchParams.get('group');
  const doneUrl  = groupId ? `/groups/${groupId}` : '/';
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    if (!groupId) return;
    api.getGroup(groupId)
      .then(group => { setGroupName(group.name); setGroupTakesOff(group.allowTakes === false); })
      .catch(() => setGroupName(''));
  }, [groupId]);

  const [postType, setPostType]     = useState('text');
  const [caption, setCaption]       = useState('');
  const [topics, setTopics]         = useState([]);
  const [hashtags, setHashtags]     = useState([]);
  const [allowTakes, setAllowTakes] = useState(true);
  const [groupTakesOff, setGroupTakesOff] = useState(false);
  const [hashtagInput, setHashtagInput] = useState('');
  const [hashtagError, setHashtagError] = useState('');
  const [files, setFiles]           = useState([]);
  const [previews, setPreviews]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [uploadProgress, setUploadProgress] = useState('');

  const fileInputRef = useRef(null);
  const warmedRef    = useRef(false);

  // Start loading the on-device model once there's something to read, so it's
  // usually ready by the time the post is shared. Group posts skip the feed.
  useEffect(() => {
    if (groupId || warmedRef.current || (!caption.trim() && !topics.length && !hashtags.length)) return;
    warmedRef.current = true;
    warmUpModel();
  }, [groupId, caption, topics, hashtags]);

  async function captionEmbedding(tags) {
    const text = postEmbeddingText(caption, topics.map(topicLabel), tags);
    if (groupId || !text) return undefined;
    try {
      const [vec] = await embedTexts([text], EMBED_TIMEOUT_MS);
      return vec;
    } catch (err) {
      console.warn('Posting without an embedding:', err.message);
      return undefined;
    }
  }

  function handleTypeSelect(type) {
    setPostType(type);
    setFiles([]);
    setPreviews([]);
    setError('');
  }

  function handleFileSelect(e) {
    const selected = Array.from(e.target.files);
    setError('');

    if (postType === 'image') {
      if (selected.length > MAX_IMAGES) {
        setError(`Maximum ${MAX_IMAGES} images per post.`);
        return;
      }
      for (const f of selected) {
        if (f.size > MAX_IMAGE_SIZE) {
          setError(`Each image must be under 20MB.`);
          return;
        }
      }
      setFiles(selected);
      setPreviews(selected.map(f => URL.createObjectURL(f)));
    }

    if (postType === 'video') {
      const f = selected[0];
      if (!f) return;
      if (f.size > MAX_VIDEO_SIZE) {
        setError('Video must be under 500MB.');
        return;
      }
      setFiles([f]);
      setPreviews([URL.createObjectURL(f)]);
    }
  }

  function toggleTopic(id) {
    setTopics(prev => prev.includes(id)
      ? prev.filter(t => t !== id)
      : prev.length < MAX_POST_TOPICS ? [...prev, id] : prev);
  }

  // Adds whatever is typed in the hashtag box; returns the updated list, or null
  // if some of it was invalid so the author can fix it before posting
  function commitHashtags() {
    if (!hashtagInput.trim()) return hashtags;
    const { list, error } = addHashtags(hashtags, hashtagInput);
    setHashtags(list);
    setHashtagError(error);
    if (error) return null;
    setHashtagInput('');
    return list;
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (postType === 'text' && !caption.trim()) {
      setError('Write something first.');
      return;
    }
    if (postType !== 'text' && files.length === 0) {
      setError('Select at least one file.');
      return;
    }

    const tags = commitHashtags();
    if (!tags) return;
    setLoading(true);
    setError('');

    try {
      let mediaKeys = [];

      // Upload media files to S3
      if (files.length > 0) {
        setUploadProgress('Getting upload URLs...');

        const fileInfos = files.map(f => ({
          name:        f.name,
          contentType: f.type,
          size:        f.size,
        }));

        const { urls } = await api.getUploadUrls(fileInfos);

        setUploadProgress(`Uploading ${files.length} file(s)...`);

        await Promise.all(urls.map(async ({ url, key }, i) => {
          await fetch(url, {
            method:  'PUT',
            body:    files[i],
            headers: { 'Content-Type': files[i].type },
          });
          mediaKeys.push(key);
        }));
      }

      setUploadProgress('Preparing for recommendations...');
      const embedding = await captionEmbedding(tags);

      setUploadProgress('Creating post...');

      await api.createPost({
        type:      postType,
        caption:   caption.trim(),
        mediaKeys,
        tags:      groupId ? [] : topics,
        hashtags:  tags,
        ...(embedding && { embedding }),
        allowTakes: allowTakes && !groupTakesOff,
        ...(groupId && { groupId }),
      });

      navigate(doneUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  }

  return (
    <div className="max-w-lg mx-auto pb-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">New Post</h1>
          {groupId && (
            <p className="text-sm text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
              <Users size={14} /> Posting to {groupName || 'group'}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate(doneUrl)}
          aria-label="Cancel"
          className="p-2 rounded-lg text-[var(--text-muted)]
                     hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)]
                     transition-all duration-200"
        >
          <X size={20} />
        </button>
      </div>

      {/* Post type selector */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { type: 'text',  icon: Type,   label: 'Text'  },
          { type: 'image', icon: Image,  label: 'Image' },
          { type: 'video', icon: Video,  label: 'Video' },
        ].map(({ type, icon: Icon, label }) => (
          <button
            key={type}
            onClick={() => handleTypeSelect(type)}
            className={`flex flex-col items-center gap-2 py-4 rounded-2xl
                        border transition-all duration-200
              ${postType === type
                ? 'bg-aura-500/15 border-aura-500/50 text-aura-400'
                : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)] hover:border-aura-500/30'
              }`}
          >
            <Icon size={22} />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* Media upload area */}
      {postType !== 'text' && (
        <div className="mb-4">
          {previews.length === 0 ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 rounded-2xl border-2 border-dashed
                         border-[var(--border)] hover:border-aura-500/50
                         flex flex-col items-center justify-center gap-3
                         text-[var(--text-muted)] hover:text-[var(--accent)]
                         transition-all duration-200"
            >
              <Upload size={28} />
              <p className="text-sm font-medium">
                {postType === 'image'
                  ? `Upload up to ${MAX_IMAGES} images`
                  : 'Upload a video (max 90 seconds)'
                }
              </p>
              <p className="text-xs">
                {postType === 'image' ? 'JPEG, PNG, WEBP — 20MB each' : 'MP4, MOV — 500MB max'}
              </p>
            </button>
          ) : (
            <div className={`grid gap-2 mb-2
              ${previews.length === 1 ? 'grid-cols-1' :
                previews.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {previews.map((preview, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden"
                     style={{ aspectRatio: '1/1' }}>
                  {postType === 'video' ? (
                    <video src={preview} className="w-full h-full object-cover" />
                  ) : (
                    <img src={preview} alt="" className="w-full h-full object-cover" />
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full
                               bg-black/60 flex items-center justify-center
                               text-white hover:bg-black/80 transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {postType === 'image' && previews.length < MAX_IMAGES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border-2 border-dashed border-[var(--border)]
                             hover:border-aura-500/50 flex items-center justify-center
                             text-[var(--text-muted)] hover:text-[var(--accent)]
                             transition-all duration-200"
                  style={{ aspectRatio: '1/1' }}
                >
                  <Upload size={20} />
                </button>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={postType === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/quicktime'}
            multiple={postType === 'image'}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Caption */}
      <div className="mb-4">
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder={postType === 'text' ? "What's on your mind?" : 'Add a caption...'}
          rows={postType === 'text' ? 6 : 3}
          maxLength={2200}
          className="input resize-none"
        />
        <p className="text-xs text-[var(--text-muted)] text-right mt-1">
          {caption.length} / 2200
        </p>
      </div>

      {!groupId && (
        <div className="mb-4">
          <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
            Topics <span className="text-[var(--text-muted)] font-normal">({topics.length}/{MAX_POST_TOPICS}, optional)</span>
          </p>
          <p className="text-xs text-[var(--text-muted)] mb-2">Helps people who want more of these find your post.</p>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map(topic => {
              const selected = topics.includes(topic.id);
              const full     = !selected && topics.length >= MAX_POST_TOPICS;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => toggleTopic(topic.id)}
                  disabled={full}
                  aria-pressed={selected}
                  className={`px-3 py-1 rounded-full border text-xs font-medium transition-all disabled:opacity-40
                    ${selected
                      ? 'bg-aura-500/20 border-aura-500/50 text-aura-400'
                      : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)] hover:border-aura-500/30'}`}>
                  {topic.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
          Hashtags <span className="text-[var(--text-muted)] font-normal">({hashtags.length}/{MAX_HASHTAGS}, optional)</span>
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-2">Your own tags, like #jazz or #streetphoto. Separate them with spaces.</p>
        <form onSubmit={e => { e.preventDefault(); commitHashtags(); }} className="flex gap-2">
          <input
            value={hashtagInput}
            onChange={e => { setHashtagInput(e.target.value); setHashtagError(''); }}
            disabled={hashtags.length >= MAX_HASHTAGS}
            placeholder={hashtags.length >= MAX_HASHTAGS ? 'Hashtag limit reached' : 'Add a hashtag'}
            aria-label="Hashtags"
            className="input flex-1 min-w-0 py-1.5 text-sm"
          />
          <button type="submit" disabled={!hashtagInput.trim()}
            className="px-3 rounded-xl text-xs font-semibold bg-aura-500/15 text-aura-400 border border-aura-500/30 disabled:opacity-40">
            Add
          </button>
        </form>
        {hashtagError && <p className="text-xs text-red-400 mt-2">{hashtagError}</p>}
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {hashtags.map(tag => (
              <span key={tag}
                className="flex items-center gap-1 pl-3 pr-1 py-1 rounded-full border text-xs font-medium bg-aura-500/20 border-aura-500/50 text-aura-400">
                #{tag}
                <button
                  type="button"
                  onClick={() => setHashtags(prev => prev.filter(t => t !== tag))}
                  aria-label={`Remove #${tag}`}
                  className="p-0.5 rounded-full hover:bg-black/20">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Taking aura: chosen once, locked after posting */}
      <div className="card mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">Allow others to take aura</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {groupTakesOff
              ? 'Taking is turned off in this group.'
              : "You can't change this after posting."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={allowTakes && !groupTakesOff}
          aria-label="Allow others to take aura"
          disabled={groupTakesOff}
          onClick={() => setAllowTakes(v => !v)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${allowTakes && !groupTakesOff ? 'bg-aura-500' : 'bg-[var(--border)]'}`}>
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform
                            ${allowTakes && !groupTakesOff ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20
                      rounded-xl px-4 py-2.5 mb-4">
          {error}
        </p>
      )}

      {/* Upload progress */}
      {uploadProgress && (
        <p className="text-aura-400 text-sm text-center mb-4">{uploadProgress}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? uploadProgress || 'Posting...' : (
          <span className="flex items-center gap-2">
            <Sparkles size={16} />
            Share Post
          </span>
        )}
      </button>
    </div>
  );
}