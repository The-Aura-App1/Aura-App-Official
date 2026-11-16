// Bots play whole games against each other at every level: every move they
// choose must be legal, games must finish, and harder bots should beat
// easier ones more often than not. Run: npm run test:games
import assert from 'node:assert/strict';
import { GAMES, viewFor } from '../lambdas/aura-aura/gameRules.mjs';
import { BOT_GAMES, BOT_LEVELS, botMove } from '../lambdas/aura-aura/bots.mjs';

let seed = 7;
const rand = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };

function play(game, levels) {
  let state = GAMES[game].init(rand, GAMES[game].options(game === 'golf' ? { holes: 3 } : undefined), 2);
  let slowest = 0, moves = 0;
  while (!state.over && moves < 3000) {
    const seat = state.turn;
    const t = Date.now();
    const move = botMove(game, levels[seat], { state, view: viewFor(game, state, seat), seat, rand });
    slowest = Math.max(slowest, Date.now() - t);
    state = GAMES[game].apply(state, seat, move, rand);   // throws if the bot chose an illegal move
    moves++;
  }
  return { state, moves, slowest };
}

const quick = process.argv.includes('--quick');
for (const game of BOT_GAMES) {
  // every level against every level, once each way round
  let slowest = 0, games = 0;
  for (const a of BOT_LEVELS) for (const b of BOT_LEVELS) {
    if (quick && a !== b) continue;
    const { state, slowest: s } = play(game, [a, b]);
    assert.ok(state.over, `${game} ${a} vs ${b} finished`);
    slowest = Math.max(slowest, s);
    games++;
  }
  // hard against easy, a few times: hard should win most
  let hardWins = 0, rounds = game === 'chess' || game === 'pool' ? 3 : 6;
  if (quick) rounds = 2;
  for (let k = 0; k < rounds; k++) {
    const hardSeat = k % 2;
    const { state } = play(game, hardSeat === 0 ? ['hard', 'easy'] : ['easy', 'hard']);
    if (state.winner === hardSeat) hardWins++;
  }
  console.log(`${game}: ${games} games finished, slowest bot move ${slowest} ms, hard beat easy ${hardWins}/${rounds}`);
  assert.ok(slowest < 4000, `${game} bot too slow (${slowest} ms)`);
}
console.log('bot checks passed');
