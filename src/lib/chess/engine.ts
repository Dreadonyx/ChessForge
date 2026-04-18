import { Chess } from 'chessops/chess';
import { parseFen, makeFen, INITIAL_FEN } from 'chessops/fen';
import { parseSquare, makeSquare, parseUci, makeUci, opposite } from 'chessops/util';
import { makeSan } from 'chessops/san';
import type { Square, Move, NormalMove, Color, Role, Piece } from 'chessops/types';
import type { Key } from '@lichess-org/chessground/types';
import type { Outcome } from 'chessops/chess';

export type GameMode = 'standard' | 'chess960';

export interface GameState {
	fen: string;
	turnColor: Color;
	isCheck: boolean;
	isCheckmate: boolean;
	isStalemate: boolean;
	isDraw: boolean;
	isEnd: boolean;
	outcome: Outcome | undefined;
	lastMove: [Key, Key] | undefined;
	dests: Map<Key, Key[]>;
	moveHistory: string[];
	capturedPieces: { white: Role[]; black: Role[] };
}

export class ChessEngine {
	private pos: Chess;
	private history: string[] = [];
	private captured: { white: Role[]; black: Role[] } = { white: [], black: [] };
	private lastMoveKeys: [Key, Key] | undefined;
	private mode: GameMode;

	constructor(mode: GameMode = 'standard', fen?: string) {
		this.mode = mode;
		if (fen) {
			const setup = parseFen(fen).unwrap();
			this.pos = Chess.fromSetup(setup).unwrap();
		} else {
			this.pos = Chess.default();
		}
	}

	static chess960(): ChessEngine {
		const pos = Chess.default();
		const fen = generate960Fen();
		return new ChessEngine('chess960', fen);
	}

	getState(): GameState {
		const ctx = this.pos.ctx();
		return {
			fen: makeFen(this.pos.toSetup()),
			turnColor: this.pos.turn,
			isCheck: this.pos.isCheck(),
			isCheckmate: this.pos.isCheckmate(ctx),
			isStalemate: this.pos.isStalemate(ctx),
			isDraw: this.pos.isInsufficientMaterial() || this.pos.halfmoves >= 100,
			isEnd: this.pos.isEnd(ctx),
			outcome: this.pos.outcome(ctx),
			lastMove: this.lastMoveKeys,
			dests: this.toDests(),
			moveHistory: [...this.history],
			capturedPieces: {
				white: [...this.captured.white],
				black: [...this.captured.black]
			}
		};
	}

	tryMove(from: Key, to: Key, promotion?: Role): boolean {
		const fromSq = parseSquare(from);
		const toSq = parseSquare(to);
		if (fromSq === undefined || toSq === undefined) return false;

		// Check if promotion is needed
		const piece = this.pos.board.get(fromSq);
		if (piece?.role === 'pawn') {
			const toRank = to[1];
			if ((piece.color === 'white' && toRank === '8') || (piece.color === 'black' && toRank === '1')) {
				promotion = promotion || 'queen';
			}
		}

		const move: NormalMove = { from: fromSq, to: toSq, promotion };
		if (!this.pos.isLegal(move)) return false;

		// Generate SAN before playing the move
		const san = makeSan(this.pos, move);

		// Track captures
		const captured = this.pos.board.get(toSq);
		if (captured) {
			this.captured[captured.color].push(captured.role);
		}
		// En passant capture
		if (piece?.role === 'pawn' && toSq === this.pos.epSquare) {
			const epColor = opposite(piece.color);
			this.captured[epColor].push('pawn');
		}

		this.pos.play(move);
		this.lastMoveKeys = [from, to];
		this.history.push(san);

		return true;
	}

	private toDests(): Map<Key, Key[]> {
		const dests = new Map<Key, Key[]>();
		const allDests = this.pos.allDests();
		for (const [sq, destSet] of allDests) {
			const from = makeSquare(sq as Square);
			const toSquares: Key[] = [];
			for (const d of destSet) {
				toSquares.push(makeSquare(d));
			}
			if (toSquares.length > 0) {
				dests.set(from as Key, toSquares as Key[]);
			}
		}
		return dests;
	}

	reset(mode?: GameMode, fen?: string): void {
		this.mode = mode || this.mode;
		this.history = [];
		this.captured = { white: [], black: [] };
		this.lastMoveKeys = undefined;

		if (fen) {
			const setup = parseFen(fen).unwrap();
			this.pos = Chess.fromSetup(setup).unwrap();
		} else if (this.mode === 'chess960') {
			const newFen = generate960Fen();
			const setup = parseFen(newFen).unwrap();
			this.pos = Chess.fromSetup(setup).unwrap();
		} else {
			this.pos = Chess.default();
		}
	}

	tryMoveUci(uci: string): boolean {
		const move = parseUci(uci);
		if (!move) return false;

		if ('from' in move) {
			const from = makeSquare(move.from) as Key;
			const to = makeSquare(move.to) as Key;
			return this.tryMove(from, to, move.promotion);
		}
		return false;
	}

	get turn(): Color {
		return this.pos.turn;
	}

	get fen(): string {
		return makeFen(this.pos.toSetup());
	}
}

// Chess960 position generator
function generate960Fen(): string {
	const pieces: string[] = new Array(8).fill('');

	// Place bishops on opposite colors
	const lightSquares = [0, 2, 4, 6];
	const darkSquares = [1, 3, 5, 7];
	const b1 = lightSquares[Math.floor(Math.random() * 4)];
	const b2 = darkSquares[Math.floor(Math.random() * 4)];
	pieces[b1] = 'B';
	pieces[b2] = 'B';

	// Place queen on random empty square
	const empty1 = pieces.map((p, i) => (p === '' ? i : -1)).filter((i) => i >= 0);
	const qi = empty1[Math.floor(Math.random() * empty1.length)];
	pieces[qi] = 'Q';

	// Place knights on random empty squares
	const empty2 = pieces.map((p, i) => (p === '' ? i : -1)).filter((i) => i >= 0);
	const n1i = Math.floor(Math.random() * empty2.length);
	pieces[empty2[n1i]] = 'N';
	empty2.splice(n1i, 1);
	const n2i = Math.floor(Math.random() * empty2.length);
	pieces[empty2[n2i]] = 'N';
	empty2.splice(n2i, 1);

	// Remaining 3 squares: R K R (king between rooks)
	const remaining = pieces.map((p, i) => (p === '' ? i : -1)).filter((i) => i >= 0);
	pieces[remaining[0]] = 'R';
	pieces[remaining[1]] = 'K';
	pieces[remaining[2]] = 'R';

	const backRank = pieces.join('').toLowerCase();
	const whiteRank = pieces.join('');

	// Determine castling rights from rook positions
	const files = 'abcdefgh';
	const rookFiles = remaining.filter((_, i) => i !== 1);
	const castling = files[rookFiles[1]].toUpperCase() + files[rookFiles[0]].toUpperCase() + files[rookFiles[1]] + files[rookFiles[0]];

	return `${backRank}/pppppppp/8/8/8/8/PPPPPPPP/${whiteRank} w ${castling} - 0 1`;
}
