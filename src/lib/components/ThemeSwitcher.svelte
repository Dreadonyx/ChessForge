<script lang="ts">
	import { onMount } from 'svelte';

	const PIECE_CDN = 'https://lichess1.org/assets/piece';
	const BOARD_CDN = 'https://lichess1.org/assets/images/board';

	const pieceSets = [
		'staunty', 'merida', 'california', 'cardinal', 'alpha', 'maestro',
		'tatiana', 'governor', 'fresca', 'gioco', 'cburnett', 'pirouetti',
		'horsey', 'kosal', 'chessnut', 'companion', 'spatial', 'celtic',
		'fantasy', 'mono', 'letter', 'pixel'
	];

	const boardThemes = [
		{ name: 'blue', ext: 'png', label: 'Blue' },
		{ name: 'green', ext: 'png', label: 'Green' },
		{ name: 'brown', ext: 'png', label: 'Brown' },
		{ name: 'purple', ext: 'png', label: 'Purple' },
		{ name: 'ic', ext: 'png', label: 'Ice' },
		{ name: 'wood', ext: 'jpg', label: 'Wood' },
		{ name: 'wood2', ext: 'jpg', label: 'Wood 2' },
		{ name: 'maple', ext: 'jpg', label: 'Maple' },
		{ name: 'marble', ext: 'jpg', label: 'Marble' },
		{ name: 'canvas', ext: 'jpg', label: 'Canvas' },
		{ name: 'metal', ext: 'jpg', label: 'Metal' },
		{ name: 'olive', ext: 'jpg', label: 'Olive' },
		{ name: 'grey', ext: 'jpg', label: 'Grey' },
		{ name: 'newspaper', ext: 'svg', label: 'Newspaper' },
		{ name: 'leather', ext: 'jpg', label: 'Leather' },
		{ name: 'blue-marble', ext: 'jpg', label: 'Blue Marble' },
	];

	const pieceMap: Record<string, string> = {
		'pawn.white': 'wP', 'knight.white': 'wN', 'bishop.white': 'wB',
		'rook.white': 'wR', 'queen.white': 'wQ', 'king.white': 'wK',
		'pawn.black': 'bP', 'knight.black': 'bN', 'bishop.black': 'bB',
		'rook.black': 'bR', 'queen.black': 'bQ', 'king.black': 'bK',
	};

	// Applied = what's currently on the board. Selected = what user is previewing.
	let appliedPieceSet = $state('staunty');
	let appliedBoard = $state('blue');
	let selectedPieceSet = $state('staunty');
	let selectedBoard = $state('blue');

	let hasChanges = $derived(
		selectedPieceSet !== appliedPieceSet || selectedBoard !== appliedBoard
	);

	function applyPieceTheme(setName: string) {
		let css = '';
		for (const [selector, file] of Object.entries(pieceMap)) {
			css += `.cg-wrap piece.${selector} { background-image: url('${PIECE_CDN}/${setName}/${file}.svg') !important; }\n`;
		}
		let el = document.getElementById('piece-theme');
		if (!el) {
			el = document.createElement('style');
			el.id = 'piece-theme';
			document.head.appendChild(el);
		}
		el.textContent = css;
	}

	function applyBoardTheme(theme: typeof boardThemes[0]) {
		let el = document.getElementById('board-theme');
		if (!el) {
			el = document.createElement('style');
			el.id = 'board-theme';
			document.head.appendChild(el);
		}
		el.textContent = `cg-board { background-image: url('${BOARD_CDN}/${theme.name}.${theme.ext}') !important; background-size: cover !important; }`;
	}

	function applyTheme() {
		applyPieceTheme(selectedPieceSet);
		const board = boardThemes.find(b => b.name === selectedBoard);
		if (board) applyBoardTheme(board);
		appliedPieceSet = selectedPieceSet;
		appliedBoard = selectedBoard;
	}

	onMount(() => {
		applyPieceTheme(appliedPieceSet);
		applyBoardTheme(boardThemes.find(b => b.name === appliedBoard)!);
	});
</script>

<div class="theme-switcher">
	<div class="theme-section">
		<h3>Pieces</h3>
		<div class="theme-grid pieces-grid">
			{#each pieceSets as set}
				<button
					class="theme-btn"
					class:active={selectedPieceSet === set}
					class:applied={appliedPieceSet === set && selectedPieceSet !== set}
					onclick={() => selectedPieceSet = set}
					title={set}
				>
					<img src="{PIECE_CDN}/{set}/wN.svg" alt={set} class="preview-piece" />
					<span>{set}</span>
				</button>
			{/each}
		</div>
	</div>

	<div class="theme-section">
		<h3>Board</h3>
		<div class="theme-grid board-grid">
			{#each boardThemes as theme}
				<button
					class="theme-btn"
					class:active={selectedBoard === theme.name}
					class:applied={appliedBoard === theme.name && selectedBoard !== theme.name}
					onclick={() => selectedBoard = theme.name}
					title={theme.label}
				>
					<img src="{BOARD_CDN}/{theme.name}.thumbnail.{theme.ext}" alt={theme.label} class="preview-board"
						onerror={(e) => { (e.target as HTMLImageElement).src = `${BOARD_CDN}/${theme.name}.${theme.ext}`; }}
					/>
					<span>{theme.label}</span>
				</button>
			{/each}
		</div>
	</div>

	<div class="apply-bar">
		<span class="change-hint">
			{#if hasChanges}
				Unsaved changes
			{:else}
				Theme applied
			{/if}
		</span>
		<button class="primary apply-btn" onclick={applyTheme} disabled={!hasChanges}>
			Apply Theme
		</button>
	</div>
</div>

<style>
	.theme-switcher {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: min(90vw, 600px);
	}

	.theme-section h3 {
		font-size: 0.85rem;
		color: #888;
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.theme-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		max-height: 220px;
		overflow-y: auto;
		padding: 0.25rem;
	}

	.theme-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		padding: 0.3rem;
		background: #1e1e1e;
		border: 2px solid transparent;
		border-radius: 6px;
		cursor: pointer;
		transition: border-color 0.15s;
	}

	.theme-btn:hover {
		border-color: #555;
	}

	.theme-btn.active {
		border-color: var(--accent);
	}

	.theme-btn.applied {
		border-color: #444;
	}

	.theme-btn span {
		font-size: 0.65rem;
		color: #999;
		max-width: 60px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview-piece {
		width: 36px;
		height: 36px;
	}

	.preview-board {
		width: 44px;
		height: 44px;
		border-radius: 3px;
		object-fit: cover;
	}

	.apply-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: #1a1a1a;
		border-radius: 8px;
		margin-top: 0.5rem;
	}

	.change-hint {
		font-size: 0.85rem;
		color: #888;
	}

	.apply-btn {
		padding: 0.6rem 2rem;
		font-size: 0.95rem;
	}

	.apply-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
