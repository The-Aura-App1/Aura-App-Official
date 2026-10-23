import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const S3_URL = 'https://aura-app-media-570934198135.s3.amazonaws.com';

export default function PostMedia({ post }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const keys = post.mediaKeys ?? [];

  if (!keys.length) return null;

  const isMultiple = keys.length > 1;
  const isVideo    = post.type === 'video';
  const currentKey = keys[currentIndex];
  const url        = `${S3_URL}/${currentKey}`;

  function prev() {
    setCurrentIndex(i => Math.max(0, i - 1));
  }

  function next() {
    setCurrentIndex(i => Math.min(keys.length - 1, i + 1));
  }

  return (
    <div className="relative bg-black w-full" style={{ aspectRatio: '1/1' }}>

      {isVideo ? (
        <video
          src={url}
          className="w-full h-full object-contain"
          controls
          playsInline
          preload="metadata"
        />
      ) : (
        <img
          src={url}
          alt="Post"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}

      {/* Carousel controls */}
      {isMultiple && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2
                         w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm
                         flex items-center justify-center
                         text-white hover:bg-black/70 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {currentIndex < keys.length - 1 && (
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2
                         w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm
                         flex items-center justify-center
                         text-white hover:bg-black/70 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          )}

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2
                          flex items-center gap-1.5">
            {keys.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`rounded-full transition-all duration-200
                  ${i === currentIndex
                    ? 'w-5 h-1.5 bg-white'
                    : 'w-1.5 h-1.5 bg-white/50'
                  }`}
              />
            ))}
          </div>
        </>
      )}

      {/* Multi-image counter */}
      {isMultiple && (
        <div className="absolute top-3 right-3
                        bg-black/50 backdrop-blur-sm
                        text-white text-xs font-medium
                        px-2 py-1 rounded-full">
          {currentIndex + 1} / {keys.length}
        </div>
      )}
    </div>
  );
}