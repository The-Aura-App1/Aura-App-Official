import React from 'react';

export default function LoadingSpinner({ size = 80 }) {
  return (
    <div className="flex items-center justify-center py-10">
      <div style={{ width: size, height: size, position: 'relative' }}>
        <img
          src="/aura-logo.png"
          alt="Loading..."
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            animation: 'haloSpin 1.8s ease-in-out infinite',
            transformOrigin: 'center center',
          }}
        />
      </div>

      <style>{`
        @keyframes haloSpin {
          0%   { transform: perspective(300px) rotateX(0deg)   rotateZ(0deg);   opacity: 1;    }
          25%  { transform: perspective(300px) rotateX(60deg)  rotateZ(90deg);  opacity: 0.7;  }
          50%  { transform: perspective(300px) rotateX(0deg)   rotateZ(180deg); opacity: 1;    }
          75%  { transform: perspective(300px) rotateX(-60deg) rotateZ(270deg); opacity: 0.7;  }
          100% { transform: perspective(300px) rotateX(0deg)   rotateZ(360deg); opacity: 1;    }
        }
      `}</style>
    </div>
  );
}