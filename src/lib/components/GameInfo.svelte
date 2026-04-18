<script lang="ts">
	import type { GameState } from '$lib/chess/engine';

	interface Props {
		state: GameState;
	}

	let { state }: Props = $props();

	const pieceSymbols: Record<string, string> = {
		king: '♚',
		queen: '♛',
		rook: '♜',
		bishop: '♝',
		knight: '♞',
		pawn: '♟'
	};

	function formatCaptures(pieces: string[]): string {
		return pieces.map((p) => pieceSymbols[p] || p).join(' ');
	}

	function statusText(state: GameState): string {
		if (state.isCheckmate) {
			const winner = state.turnColor === 'white' ? 'Black' : 'White';
			return `Checkmate! ${winner} wins`;
		}
		if (state.isStalemate) return 'Stalemate — Draw';
		if (state.isDraw) return 'Draw';
		if (state.isCheck) return `${capitalize(state.turnColor)} is in check`;
		return `${capitalize(state.turnColor)} to move`;
	}

	function capitalize(s: string): string {
		return s[0].toUpperCase() + s.slice(1);
	}
</script>

<div class="game-info">
	<div class="status" class:check={state.isCheck} class:end={state.isEnd}>
		{statusText(state)}
	</div>

	<div class="captures">
		{#if state.capturedPieces.white.length > 0}
			<div class="capture-row">
				<span class="label">White captured:</span>
				<span class="pieces">{formatCaptures(state.capturedPieces.white)}</span>
			</div>
		{/if}
		{#if state.capturedPieces.black.length > 0}
			<div class="capture-row">
				<span class="label">Black captured:</span>
				<span class="pieces">{formatCaptures(state.capturedPieces.black)}</span>
			</div>
		{/if}
	</div>

	{#if state.moveHistory.length > 0}
		<div class="moves">
			<h3>Moves</h3>
			<div class="move-list">
				{#each state.moveHistory as move, i}
					{#if i % 2 === 0}
						<span class="move-number">{Math.floor(i / 2) + 1}.</span>
					{/if}
					<span class="move">{move}</span>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.game-info {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 220px;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.status {
		font-size: 1.1rem;
		font-weight: 600;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		background: #2a2a2a;
		color: #e0e0e0;
		text-align: center;
	}

	.status.check {
		background: #c62828;
		color: white;
	}

	.status.end {
		background: #1565c0;
		color: white;
	}

	.captures {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.capture-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		font-size: 0.9rem;
		color: #aaa;
	}

	.pieces {
		font-size: 1.2rem;
		letter-spacing: 2px;
	}

	.moves h3 {
		margin: 0 0 0.5rem;
		font-size: 0.95rem;
		color: #888;
	}

	.move-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		font-family: 'Courier New', monospace;
		font-size: 0.85rem;
		color: #ccc;
		max-height: 200px;
		overflow-y: auto;
		padding: 0.5rem;
		background: #1e1e1e;
		border-radius: 6px;
	}

	.move-number {
		color: #666;
		margin-left: 0.3rem;
	}

	.move {
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
	}

	.move:hover {
		background: #333;
	}
</style>
