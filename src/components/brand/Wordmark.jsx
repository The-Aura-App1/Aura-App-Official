import React from 'react';

// The "Aura App" logotype: Fraunces italic with its soft, slightly wonky
// letterforms, in solid ink, with the logo's halo (aura-halo.png, the same
// one as the app icon) tilted over the "A". `halo={false}` leaves it off,
// e.g. where the big halo already sits above the name.
export default function Wordmark({ className = '', halo = true }) {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="aura-wordmark">Aura<span className="aura-wordmark-app"> App</span></span>
      {halo && <img src="/aura-halo.png" alt="" aria-hidden="true" className="aura-wordmark-halo" />}
    </span>
  );
}
