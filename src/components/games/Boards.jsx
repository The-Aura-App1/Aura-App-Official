import Connect4Board from './Connect4Board';
import PokerTable from './PokerTable';
import GoFishPond from './GoFishPond';
import DiceTray from './DiceTray';
import CoinToss from './CoinToss';
import PoolTable from './PoolTable';

// One board per game. Each gets the server's view of the match for this
// viewer, their seat (0, 1, or null when watching), the players, and
// move(m), which sends a move and resolves once the server has answered.
// The boards never decide what's legal; they show what the view allows.
export const BOARDS = { connect4: Connect4Board, pool: PoolTable, poker: PokerTable, gofish: GoFishPond, dice: DiceTray, coinflip: CoinToss };
