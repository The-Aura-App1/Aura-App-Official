import Connect4Board from './Connect4Board';
import PokerTable from './PokerTable';
import GoFishPond from './GoFishPond';
import DiceTray from './DiceTray';
import CoinToss from './CoinToss';
import PoolTable from './PoolTable';
import ChessBoard from './ChessBoard';
import Crazy8Table from './Crazy8Table';
import GolfCourse from './GolfCourse';

// One board per game. Each gets the server's view of the match for this
// viewer, their seat (or null when watching), the players, and move(m),
// which sends a move and resolves once the server has answered. The boards
// never decide what's legal; they show what the view allows.
export const BOARDS = {
  connect4: Connect4Board, pool: PoolTable, chess: ChessBoard, poker: PokerTable, gofish: GoFishPond,
  crazy8: Crazy8Table, golf: GolfCourse, dice: DiceTray, coinflip: CoinToss,
};
