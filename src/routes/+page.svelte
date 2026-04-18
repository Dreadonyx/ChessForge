<script lang="ts">
	import ChessBoard from '$lib/components/ChessBoard.svelte';
	import GameInfo from '$lib/components/GameInfo.svelte';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import BoardEditor from '$lib/components/BoardEditor.svelte';
	import { ChessEngine, type GameMode, type GameState } from '$lib/chess/engine';

	type View = 'play' | 'editor' | 'theme';

	let view: View = $state('play');
	let mode: GameMode = $state('standard');
	let engine = $state(new ChessEngine(mode));
	let gameState: GameState = $state(engine.getState());
	let boardComponent: ChessBoard | undefined = $state();
	let showPromotion = $state(false);
	let pendingPromotion: { from: string; to: string } | null = $state(null);

	function handleMove(from: string, to: string) {
		const piece = getPieceAt(from);
		const toRank = to[1];

		if (piece === 'pawn' && (toRank === '8' || toRank === '1')) {
			pendingPromotion = { from, to };
			showPromotion = true;
			return;
		}

		const success = engine.tryMove(from, to);
		if (success) {
			gameState = engine.getState();
		}
	}

	function getPieceAt(square: string): string | undefined {
		const fen = gameState.fen.split(' ')[0];
		const file = square.charCodeAt(0) - 97;
		const rank = parseInt(square[1]) - 1;
		const rows = fen.split('/').reverse();
		const row = rows[rank];
		let col = 0;
		for (const ch of row) {
			if (ch >= '1' && ch <= '8') {
				col += parseInt(ch);
			} else {
				if (col === file) {
					const roles: Record<string, string> = {
						p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king'
					};
					return roles[ch.toLowerCase()];
				}
				col++;
			}
		}
		return undefined;
	}

	function promote(role: 'queen' | 'rook' | 'bishop' | 'knight') {
		if (pendingPromotion) {
			engine.tryMove(pendingPromotion.from, pendingPromotion.to, role);
			gameState = engine.getState();
			pendingPromotion = null;
			showPromotion = false;
		}
	}

	function newGame(newMode?: GameMode) {
		if (newMode !== undefined) mode = newMode;
		engine.reset(mode);
		gameState = engine.getState();
	}

	function flipBoard() {
		boardComponent?.toggleOrientation();
	}

	function startFromEditor(fen: string) {
		mode = 'standard';
		engine = new ChessEngine('standard', fen);
		gameState = engine.getState();
		view = 'play';
	}

	const promotionPieces = [
		{ role: 'queen' as const, symbol: '♛' },
		{ role: 'rook' as const, symbol: '♜' },
		{ role: 'bishop' as const, symbol: '♝' },
		{ role: 'knight' as const, symbol: '♞' }
	];
</script>

<div class="page">
	<nav class="tabs">
		<button class:active={view === 'play'} class="tab" onclick={() => view = 'play'}>Play</button>
		<button class:active={view === 'editor'} class="tab" onclick={() => view = 'editor'}>Board Editor</button>
		<button class:active={view === 'theme'} class="tab" onclick={() => view = 'theme'}>Theme</button>
	</nav>

	{#if view === 'play'}
		<div class="game-container">
			<div class="controls">
				<div class="mode-select">
					<button class:active={mode === 'standard'} class="secondary" onclick={() => newGame('standard')}>
						Standard
					</button>
					<button class:active={mode === 'chess960'} class="secondary" onclick={() => newGame('chess960')}>
						Chess960
					</button>
				</div>
				<div class="actions">
					<button class="secondary" onclick={() => newGame()}>New Game</button>
					<button class="secondary" onclick={flipBoard}>Flip Board</button>
				</div>
			</div>

			<div class="play-area">
				<div class="board-area">
					<ChessBoard
						bind:this={boardComponent}
						fen={gameState.fen}
						turnColor={gameState.turnColor}
						dests={gameState.dests}
						lastMove={gameState.lastMove}
						isCheck={gameState.isCheck}
						onMove={handleMove}
					/>

					{#if showPromotion}
						<div class="promotion-overlay">
							<div class="promotion-dialog">
								<p>Promote to:</p>
								<div class="promotion-pieces">
									{#each promotionPieces as { role, symbol }}
										<button class="promotion-btn" onclick={() => promote(role)}>
											{symbol}
										</button>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				</div>

				<GameInfo state={gameState} />
			</div>
		</div>
	{:else if view === 'editor'}
		<BoardEditor onStartGame={startFromEditor} />
	{:else if view === 'theme'}
		<ThemeSwitcher />
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		width: 100%;
		max-width: 1000px;
	}

	.tabs {
		display: flex;
		gap: 0.25rem;
		background: #1a1a1a;
		padding: 0.25rem;
		border-radius: 8px;
	}

	.tab {
		padding: 0.5rem 1.2rem;
		background: transparent;
		color: #888;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.15s;
	}

	.tab:hover {
		color: #ccc;
	}

	.tab.active {
		background: var(--accent);
		color: white;
	}

	.game-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		width: 100%;
	}

	.controls {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.mode-select,
	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.play-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
	}

	.board-area {
		position: relative;
	}

	.promotion-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		border-radius: 4px;
	}

	.promotion-dialog {
		background: #2a2a2a;
		padding: 1.5rem;
		border-radius: 12px;
		text-align: center;
	}

	.promotion-dialog p {
		margin-bottom: 1rem;
		font-size: 1.1rem;
	}

	.promotion-pieces {
		display: flex;
		gap: 0.5rem;
	}

	.promotion-btn {
		font-size: 2.5rem;
		padding: 0.5rem 1rem;
		background: #1e1e1e;
		border-radius: 8px;
		color: white;
		border: 2px solid transparent;
		transition: border-color 0.15s;
	}

	.promotion-btn:hover {
		border-color: var(--accent);
	}

	@media (min-width: 768px) {
		.play-area {
			flex-direction: row;
			align-items: flex-start;
		}
	}
</style>
