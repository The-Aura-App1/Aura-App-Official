import React from 'react';
import useReveal from '../../hooks/useReveal';

// Rises gently into place the first time it scrolls into view.
export default function Reveal({ children, delay = 0, className = '' }) {
  const [ref, shown] = useReveal();
  return (
    <div ref={ref} className={`aura-reveal ${shown ? 'is-shown' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
