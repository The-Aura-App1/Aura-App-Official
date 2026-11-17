import React, { useEffect } from 'react';
import { loadPostFont } from '../../utils/postStyle';

// The "Aura App" logotype in solid ink, with the logo's halo (aura-halo.png,
// the same one as the app icon) around the tip of the "A": its back half
// behind the letter and its front half over it, so the tip pokes through the
// ring. `halo={false}` leaves it off, e.g. where the big halo already sits
// above the name. The face and placement are in index.css (.aura-wordmark).
export default function Wordmark({ className = '', halo = true }) {
  useEffect(() => { loadPostFont('sacramento'); }, []);
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="aura-wordmark">
        <span className="aura-wordmark-text">Aura<span className="aura-wordmark-app"> App</span></span>
        {halo && <img src="/aura-halo.webp" alt="" aria-hidden="true" className="aura-wordmark-halo" />}
        {halo && <img src="/aura-halo.webp" alt="" aria-hidden="true" className="aura-wordmark-halo is-front" />}
      </span>
    </span>
  );
}
