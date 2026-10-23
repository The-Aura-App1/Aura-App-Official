import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, Video, Type, X, Upload, Sparkles } from 'lucide-react';
import { api } from '../api';

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;  // 20MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB

export default function CreatePost() {
  const navigate = useNavigate();

  const [postType, setPostType]     = useState('text');
  const [caption, setCaption]       = useState('');
  const [files, setFiles]           = useState([]);
  const [previews, setPreviews]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [uploadProgress, setUploadProgress] = useState('');

  const fileInputRef = useRef(null);

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

      setUploadProgress('Creating post...');

      await api.createPost({
        type:      postType,
        caption:   caption.trim(),
        mediaKeys,
        tags:      [],
      });

      navigate('/');
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
        <h1 className="text-xl font-bold text-[var(--text-primary)]">New Post</h1>
        <button
          onClick={() => navigate('/')}
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