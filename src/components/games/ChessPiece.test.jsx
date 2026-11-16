import React from 'react';
import { render } from '@testing-library/react';
import ChessPiece from './ChessPiece';
import PlayingCard from './PlayingCard';

test('every piece is drawn as SVG with a clear side, never as a text symbol', () => {
  const start = 'rnbqkbnrpppppppp' + 'PPPPPPPPRNBQKBNR';
  const { container } = render(<div>{[...start].map((p, i) => <ChessPiece key={i} p={p} />)}</div>);
  const pieces = container.querySelectorAll('svg.chess-art');
  expect(pieces).toHaveLength(32);
  expect(container.querySelectorAll('[data-side="w"]')).toHaveLength(16);
  expect(container.querySelectorAll('[data-side="b"]')).toHaveLength(16);
  expect(container.querySelectorAll('[data-piece="p"]')).toHaveLength(16);
  // the two sides are filled differently
  const white = container.querySelector('[data-side="w"]').getAttribute('fill');
  const black = container.querySelector('[data-side="b"]').getAttribute('fill');
  expect(white).not.toBe(black);
  expect(container.textContent).toBe('');
});

test('card suits are SVG in the card color, not emoji-prone text', () => {
  const { container } = render(<PlayingCard card="Ah" />);
  expect(container.querySelectorAll('svg[data-suit="h"]').length).toBeGreaterThan(0);
  expect(container.textContent).not.toMatch(/[♠♥♦♣]/);
});
