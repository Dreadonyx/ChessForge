<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chessground } from '@lichess-org/chessground';
	import type { Api } from '@lichess-org/chessground/api';
	import type { Key, Piece as CgPiece } from '@lichess-org/chessground/types';

	interface Props {
		onStartGame?: (fen: string) => void;
	}

	let { onStartGame }: Props = $props();

	let boardEl: HTMLDivElement;
	let ground: Api | undefined;

	type PieceColor = 'white' | 'black';
	type PieceRole = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';

	let selectedPiece: { color: PieceColor; role: PieceRole } | null = $state(null);
	let eraseMode = $state(false);
	let turnColor: PieceColor = $state('white');
	let errorMsg: string | null = $state(null);

	const pieces: { role: PieceRole; symbol: string }[] = [
		{ role: 'king', symbol: '♚' },
		{ role: 'queen', symbol: '♛' },
		{ role: 'rook', symbol: '♜' },
		{ role: 'bishop', symbol: '♝' },
		{ role: 'knight', symbol: '♞' },
		{ role: 'pawn', symbol: '♟' }
	];

	onMount(() => {
		ground = Chessground(boardEl, {
			fen: '8/8/8/8/8/8/8/8',
			coordinates: true,
			movable: { free: true, color: 'both' },
			draggable: { enabled: true },
			animation: { enabled: false },
			premovable: { enabled: false },
			highlight: { lastMove: false },
			events: {
				select: (key: Key) => {
					if (!ground) return;
					if (eraseMode) {
						const pieces = new Map<Key, CgPiece | undefined>();
						pieces.set(key, undefined);
						ground.setPieces(pieces);
					} else if (selectedPiece) {
						ground.newPiece(
							{ role: selectedPiece.role, color: selectedPiece.color },
							key
						);
					}
				}
			}
		});

		requestAnimationFrame(() => {
			ground?.redrawAll();
		});
	});

	onDestroy(() => {
		ground?.destroy();
	});

	function selectPiece(color: PieceColor, role: PieceRole) {
		eraseMode = false;
		if (selectedPiece?.color === color && selectedPiece?.role === role) {
			selectedPiece = null;
		} else {
			selectedPiece = { color, role };
		}
	}

	function toggleErase() {
		selectedPiece = null;
		eraseMode = !eraseMode;
	}

	function clearBoard() {
		ground?.set({ fen: '8/8/8/8/8/8/8/8' });
	}

	function setStartingPosition() {
		ground?.set({ fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR' });
	}

	function validatePosition(boardFen: string): string | null {
		const rows = boardFen.split('/');
		if (rows.length !== 8) return 'Invalid board layout';

		let whiteKings = 0, blackKings = 0;
		let whitePieces = 0, blackPieces = 0;
		let pawnsOnEdge = false;

		for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
			const row = rows[rankIdx];
			const actualRank = 8 - rankIdx; // rank 8 is first row in FEN
			let col = 0;
			for (const ch of row) {
				if (ch >= '1' && ch <= '8') {
					col += parseInt(ch);
				} else {
					const isWhite = ch === ch.toUpperCase();
					const lower = ch.toLowerCase();

					if (isWhite) whitePieces++;
					else blackPieces++;

					if (lower === 'k') {
						if (isWhite) whiteKings++;
						else blackKings++;
					}
					if (lower === 'p' && (actualRank === 1 || actualRank === 8)) {
						pawnsOnEdge = true;
					}
					col++;
				}
			}
		}

		if (whitePieces === 0 && blackPieces === 0) return 'Board is empty — place some pieces first';
		if (whiteKings === 0) return 'White must have a king';
		if (blackKings === 0) return 'Black must have a king';
		if (whiteKings > 1) return 'White can only have one king';
		if (blackKings > 1) return 'Black can only have one king';
		if (whitePieces > 16) return 'White has too many pieces (max 16)';
		if (blackPieces > 16) return 'Black has too many pieces (max 16)';
		if (pawnsOnEdge) return 'Pawns cannot be on the 1st or 8th rank';

		return null;
	}

	function startGame() {
		if (!ground) return;
		const boardFen = ground.getFen();

		const error = validatePosition(boardFen);
		if (error) {
			errorMsg = error;
			return;
		}

		// Determine castling rights based on piece positions
		let castling = '';
		const rows = boardFen.split('/');
		const rank1 = rows[7]; // white's back rank
		const rank8 = rows[0]; // black's back rank

		// Check white castling (king on e1, rooks on a1/h1)
		if (rank1 === 'R3K2R' || hasKingAndRooks(rank1, true)) {
			if (hasRookAt(rank1, 7)) castling += 'K';
			if (hasRookAt(rank1, 0)) castling += 'Q';
		}
		// Check black castling
		if (hasKingAndRooks(rank8, false)) {
			if (hasRookAtBlack(rank8, 7)) castling += 'k';
			if (hasRookAtBlack(rank8, 0)) castling += 'q';
		}

		if (castling === '') castling = '-';

		const fen = `${boardFen} ${turnColor[0]} ${castling} - 0 1`;
		onStartGame?.(fen);
	}

	function hasKingAndRooks(row: string, white: boolean): boolean {
		const k = white ? 'K' : 'k';
		const r = white ? 'R' : 'r';
		return row.includes(k) && row.includes(r);
	}

	function hasRookAt(row: string, targetCol: number): boolean {
		let col = 0;
		for (const ch of row) {
			if (ch >= '1' && ch <= '8') col += parseInt(ch);
			else {
				if (col === targetCol && ch === 'R') return true;
				col++;
			}
		}
		return false;
	}

	function hasRookAtBlack(row: string, targetCol: number): boolean {
		let col = 0;
		for (const ch of row) {
			if (ch >= '1' && ch <= '8') col += parseInt(ch);
			else {
				if (col === targetCol && ch === 'r') return true;
				col++;
			}
		}
		return false;
	}

	function dismissError() {
		errorMsg = null;
	}

	function isSelected(color: PieceColor, role: PieceRole): boolean {
		return selectedPiece?.color === color && selectedPiece?.role === role;
	}
</script>

<div class="editor-container">
	<div class="editor-board">
		<div class="board" bind:this={boardEl}></div>
	</div>

	<div class="editor-panel">
		<h3>Board Editor</h3>
		<p class="hint">Click a piece below, then click a square to place it</p>

		<div class="piece-palette">
			<div class="palette-row">
				<span class="row-label">White</span>
				{#each pieces as { role, symbol }}
					<button
						class="palette-btn white-piece"
						class:active={isSelected('white', role)}
						onclick={() => selectPiece('white', role)}
						title={role}
					>
						{symbol}
					</button>
				{/each}
			</div>
			<div class="palette-row">
				<span class="row-label">Black</span>
				{#each pieces as { role, symbol }}
					<button
						class="palette-btn black-piece"
						class:active={isSelected('black', role)}
						onclick={() => selectPiece('black', role)}
						title={role}
					>
						{symbol}
					</button>
				{/each}
			</div>
		</div>

		<div class="tool-row">
			<button class="secondary" class:active={eraseMode} onclick={toggleErase}>
				Erase
			</button>
			<button class="secondary" onclick={clearBoard}>Clear</button>
			<button class="secondary" onclick={setStartingPosition}>Standard</button>
		</div>

		<div class="turn-select">
			<span>First to move:</span>
			<button class="secondary" class:active={turnColor === 'white'} onclick={() => turnColor = 'white'}>
				White
			</button>
			<button class="secondary" class:active={turnColor === 'black'} onclick={() => turnColor = 'black'}>
				Black
			</button>
		</div>

		<button class="primary start-btn" onclick={startGame}>
			Play from this position
		</button>
	</div>
</div>

{#if errorMsg}
	<div class="error-overlay" onclick={dismissError} onkeydown={(e) => e.key === 'Escape' && dismissError()} role="dialog" tabindex="-1">
		<div class="error-popup" onclick={(e) => e.stopPropagation()}>
			<div class="error-icon">!</div>
			<h3>Illegal Position</h3>
			<p>{errorMsg}</p>
			<button class="primary" onclick={dismissError}>Got it</button>
		</div>
	</div>
{/if}

<style>
	.editor-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
	}

	.editor-board {
		width: 100%;
		max-width: 560px;
		aspect-ratio: 1;
		position: relative;
	}
	.board {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}

	.editor-panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: min(90vw, 560px);
	}

	.editor-panel h3 {
		font-size: 1.1rem;
		font-weight: 600;
	}

	.hint {
		font-size: 0.8rem;
		color: #888;
	}

	.piece-palette {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.palette-row {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.row-label {
		font-size: 0.75rem;
		color: #888;
		width: 40px;
	}

	.palette-btn {
		font-size: 1.8rem;
		width: 48px;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #1e1e1e;
		border: 2px solid transparent;
		border-radius: 6px;
		cursor: pointer;
		transition: border-color 0.15s;
	}

	.palette-btn:hover {
		border-color: #555;
	}

	.palette-btn.active {
		border-color: var(--accent);
		background: #2a2a3a;
	}

	.white-piece {
		color: #fff;
		text-shadow: 0 0 3px rgba(0,0,0,0.5);
	}

	.black-piece {
		color: #333;
		text-shadow: 0 0 3px rgba(255,255,255,0.3);
	}

	.tool-row {
		display: flex;
		gap: 0.5rem;
	}

	.turn-select {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: #ccc;
	}

	.start-btn {
		margin-top: 0.5rem;
		padding: 0.8rem;
		font-size: 1rem;
	}

	.error-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
	}

	.error-popup {
		background: #2a2a2a;
		border: 1px solid #c62828;
		border-radius: 16px;
		padding: 2rem;
		text-align: center;
		max-width: 360px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		animation: popIn 0.2s ease-out;
	}

	@keyframes popIn {
		from { transform: scale(0.9); opacity: 0; }
		to { transform: scale(1); opacity: 1; }
	}

	.error-icon {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: #c62828;
		color: white;
		font-size: 1.5rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.error-popup h3 {
		font-size: 1.1rem;
		color: #ff5252;
	}

	.error-popup p {
		color: #ccc;
		font-size: 0.95rem;
		line-height: 1.4;
	}

	.error-popup button {
		margin-top: 0.5rem;
		min-width: 100px;
	}

	@media (min-width: 768px) {
		.editor-container {
			flex-direction: row;
			align-items: flex-start;
		}

		.editor-panel {
			width: 300px;
		}
	}
</style>
