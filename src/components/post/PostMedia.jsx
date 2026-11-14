import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import FeedVideo from './FeedVideo';

const S3_URL = 'https://aura-app-media-570934198135.s3.amazonaws.com';

// Feed videos fill their box like Instagram's: anywhere from portrait 4:5 to
// wide 1.91:1, cropped to fit. On the post page (`maxHeight`) the box takes
// the video's exact shape, as large as fits under maxHeight, so there are no bars.
const FEED_ASPECT = [4 / 5, 1.91];

export default function PostMedia({ post, seekable = false, maxHeight, className = '' }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [aspect, setAspect] = useState(1);
  const keys = post.mediaKeys ?? [];

  if (!keys.length) return null;

  const isMultiple = keys.length > 1;
  const isVideo    = post.type === 'video';
  const currentKey = keys[currentIndex];
  const url        = `${S3_URL}/${currentKey}`;

  const shape = !isVideo ? 1
    : maxHeight ? aspect
    : Math.min(FEED_ASPECT[1], Math.max(FEED_ASPECT[0], aspect));
  const boxStyle = maxHeight
    ? { aspectRatio: String(shape), width: `min(100%, calc(${maxHeight} * ${shape}))` }
    : { aspectRatio: String(shape) };

  function prev() {
    setCurrentIndex(i => Math.max(0, i - 1));
  }

  function next() {
    setCurrentIndex(i => Math.min(keys.length - 1, i + 1));
  }

  return (
    <div className={`relative bg-black w-full mx-auto ${className}`} style={boxStyle}>

      {isVideo ? (
        <FeedVideo key={url} src={url} seekable={seekable} onAspect={setAspect} />
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