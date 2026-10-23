import React from 'react';

// aura-halo.png is the halo from aura-logo.png on a transparent background with
// its white shine marks painted out; aura-halo-shine.png holds just those marks.
// Both are centred on the ring, which is tilted RING_TILT degrees and squashed
// to RING_SQUASH of its width (measured from the image).
const RING_TILT   = 11.65;
const RING_SQUASH = 0.5;

// Moves the shine around the ring: undo the tilt and squash so the ring is a
// flat circle, rotate it, then put the tilt and squash back. The marks stay on
// the ring's outer edge as they travel.
function spinTransform(deg) {
  return `rotate(${RING_TILT}deg) scaleY(${RING_SQUASH}) rotate(${deg}deg) scaleY(${1 / RING_SQUASH}) rotate(${-RING_TILT}deg)`;
}

const layerStyle = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'contain',
};

export default function LoadingSpinner({ size = 80 }) {
  return (
    <div className="flex items-center justify-center py-10">
      {/* Perspective on the container gives the wobble real depth */}
      <div style={{ width: size, height: size, perspective: size * 3.75 }}>
        <div
          role="status"
          aria-label="Loading"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            animation: 'haloWobble 2.6s ease-in-out infinite',
          }}>
          <img src="/aura-halo.png" alt="" style={layerStyle} />
          <img
            src="/aura-halo-shine.png"
            alt=""
            style={{ ...layerStyle, animation: 'haloShine 2s linear infinite', transformOrigin: 'center center' }}
          />
        </div>
      </div>

      <style>{`
        @keyframes haloShine {
          from { transform: ${spinTransform(0)}; }
          to   { transform: ${spinTransform(360)}; }
        }
        /* Tiny precession, like a spinning top. Its period doesn't divide the
           shine's, so the combined motion doesn't repeat exactly. */
        @keyframes haloWobble {
          0%   { transform: rotateX(3deg)  rotateY(0deg);  }
          25%  { transform: rotateX(0deg)  rotateY(3deg);  }
          50%  { transform: rotateX(-3deg) rotateY(0deg);  }
          75%  { transform: rotateX(0deg)  rotateY(-3deg); }
          100% { transform: rotateX(3deg)  rotateY(0deg);  }
        }
      `}</style>
    </div>
  );
}
