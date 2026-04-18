<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import ChessBoard from '$lib/components/ChessBoard.svelte';
	import GameInfo from '$lib/components/GameInfo.svelte';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import BoardEditor from '$lib/components/BoardEditor.svelte';
	import { ChessEngine, type GameMode, type GameState } from '$lib/chess/engine';
	import { StockfishEngine } from '$lib/chess/stockfish';
	import { ChessPeer, type PeerMessage } from '$lib/chess/peer';
	import type { Key } from '@lichess-org/chessground/types';

	type View = 'play' | 'editor' | 'theme';
	type Opponent = 'local' | 'ai' | 'online';

	let view: View = $state('play');
	let mode: GameMode = $state('standard');
	let opponent: Opponent = $state('local');
	let playerColor: 'white' | 'black' = $state('white');
	let aiThinking = $state(false);
	let aiReady = $state(false);

	let engine = new ChessEngine(mode);
	let gameState: GameState = $state(engine.getState());
	let boardComponent: ChessBoard | undefined = $state();
	let showPromotion = $state(false);
	let pendingPromotion: { from: string; to: string } | null = $state(null);
	let resigned = $state(false);

	// AI
	let stockfish: StockfishEngine | null = null;
	const skillPresets = [
		{ label: 'Beginner', depth: 3, skill: 1 },
		{ label: 'Easy', depth: 5, skill: 5 },
		{ label: 'Medium', depth: 8, skill: 10 },
		{ label: 'Hard', depth: 12, skill: 15 },
		{ label: 'Max', depth: 16, skill: 20 }
	];
	let selectedPreset = $state(2);

	// P2P Online
	let peer: ChessPeer | null = null;
	let peerStatus = $state('');
	let peerConnected = $state(false);
	let gameCode = $state('');
	let joinCode = $state('');
	let showOnlinePanel = $state(false);
	let takebackRequested = $state(false);
	let takebackIncoming = $state(false);
	let copied = $state(false);

	onMount(async () => {
		stockfish = new StockfishEngine();
		try {
			await stockfish.init();
			stockfish.setSkillLevel(skillPresets[selectedPreset].skill);
			aiReady = true;
		} catch (err) {
			console.error('Failed to init Stockfish:', err);
		}
	});

	onDestroy(() => {
		stockfish?.destroy();
		peer?.disconnect();
	});

	// --- AI ---
	async function makeAiMove() {
		if (!stockfish || !aiReady) return;
		const currentState = engine.getState();
		if (currentState.isEnd) return;
		if (currentState.turnColor === playerColor) return;

		aiThinking = true;
		const preset = skillPresets[selectedPreset];
		const bestMoveUci = await stockfish.getBestMove(currentState.fen, preset.depth);
		if (bestMoveUci) {
			engine.tryMoveUci(bestMoveUci);
			gameState = engine.getState();
		}
		aiThinking = false;
	}

	// --- Move handling ---
	function handleMove(from: string, to: string) {
		// In online mode, only allow moves on your turn
		if (opponent === 'online' && gameState.turnColor !== playerColor) return;

		const piece = getPieceAt(from);
		const toRank = to[1];

		if (piece === 'pawn' && (toRank === '8' || toRank === '1')) {
			pendingPromotion = { from, to };
			showPromotion = true;
			return;
		}

		const success = engine.tryMove(from as Key, to as Key);
		if (success) {
			gameState = engine.getState();

			if (opponent === 'online') {
				peer?.send({ type: 'move', from, to });
			} else if (opponent === 'ai' && !gameState.isEnd) {
				setTimeout(() => makeAiMove(), 100);
			}
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
			const { from, to } = pendingPromotion;
			engine.tryMove(from as Key, to as Key, role);
			gameState = engine.getState();
			pendingPromotion = null;
			showPromotion = false;

			if (opponent === 'online') {
				peer?.send({ type: 'move', from, to, promotion: role });
			} else if (opponent === 'ai' && !gameState.isEnd) {
				setTimeout(() => makeAiMove(), 100);
			}
		}
	}

	// --- Game control ---
	function newGame(newMode?: GameMode) {
		if (newMode !== undefined) mode = newMode;
		resigned = false;
		takebackRequested = false;
		takebackIncoming = false;
		engine.reset(mode);
		gameState = engine.getState();
		stockfish?.newGame();

		if (opponent === 'online') {
			peer?.send({ type: 'new-game' });
		} else if (opponent === 'ai' && playerColor === 'black') {
			makeAiMove();
		}
	}

	function setOpponent(op: Opponent) {
		if (op === 'online') {
			opponent = op;
			showOnlinePanel = true;
			return;
		}
		if (opponent === 'online') {
			peer?.disconnect();
			peerConnected = false;
			gameCode = '';
			showOnlinePanel = false;
		}
		opponent = op;
		newGame();
	}

	function setDifficulty(index: number) {
		selectedPreset = index;
		stockfish?.setSkillLevel(skillPresets[index].skill);
	}

	function togglePlayerColor() {
		playerColor = playerColor === 'white' ? 'black' : 'white';
		newGame();
	}

	function flipBoard() {
		boardComponent?.toggleOrientation();
	}

	function resign() {
		if (gameState.isEnd || resigned) return;
		resigned = true;
		if (opponent === 'online') {
			peer?.send({ type: 'resign' });
		}
	}

	function takeBack() {
		if (aiThinking || resigned) return;

		if (opponent === 'online') {
			if (!takebackRequested) {
				takebackRequested = true;
				peer?.send({ type: 'takeback-request' });
			}
			return;
		}

		if (opponent === 'ai') {
			engine.undo();
			engine.undo();
		} else {
			engine.undo();
		}
		gameState = engine.getState();
	}

	function acceptTakeback() {
		takebackIncoming = false;
		engine.undo();
		engine.undo();
		gameState = engine.getState();
		peer?.send({ type: 'takeback-accept' });
	}

	function denyTakeback() {
		takebackIncoming = false;
		peer?.send({ type: 'takeback-deny' });
	}

	// --- P2P Online ---
	function setupPeerHandlers() {
		if (!peer) return;

		peer.onStatusChange((status) => {
			peerStatus = status;
			peerConnected = peer?.connected ?? false;
		});

		peer.onMessageReceived((msg: PeerMessage) => {
			switch (msg.type) {
				case 'move': {
					const success = engine.tryMove(msg.from as Key, msg.to as Key, msg.promotion as any);
					if (success) {
						gameState = engine.getState();
					}
					break;
				}
				case 'resign':
					resigned = true;
					break;
				case 'takeback-request':
					takebackIncoming = true;
					break;
				case 'takeback-accept':
					takebackRequested = false;
					engine.undo();
					engine.undo();
					gameState = engine.getState();
					break;
				case 'takeback-deny':
					takebackRequested = false;
					break;
				case 'new-game':
					resigned = false;
					takebackRequested = false;
					takebackIncoming = false;
					engine.reset(mode);
					gameState = engine.getState();
					break;
			}
		});
	}

	async function createGame() {
		peer?.disconnect();
		peer = new ChessPeer();
		setupPeerHandlers();
		try {
			const id = await peer.createGame();
			gameCode = id;
			playerColor = 'white';
			peerConnected = false;
			resigned = false;
			engine.reset(mode);
			gameState = engine.getState();

			// Poll for connection
			const checkConn = setInterval(() => {
				if (peer?.connected) {
					peerConnected = true;
					peerStatus = 'Opponent connected!';
					clearInterval(checkConn);
				}
			}, 500);
		} catch (err) {
			peerStatus = 'Failed to create game';
		}
	}

	async function joinGame() {
		if (!joinCode.trim()) return;
		peer?.disconnect();
		peer = new ChessPeer();
		setupPeerHandlers();
		try {
			await peer.joinGame(joinCode.trim());
			playerColor = 'black';
			peerConnected = true;
			resigned = false;
			showOnlinePanel = false;
			engine.reset(mode);
			gameState = engine.getState();
		} catch (err) {
			peerStatus = 'Failed to join game';
		}
	}

	function copyGameCode() {
		navigator.clipboard.writeText(gameCode);
		copied = true;
		setTimeout(() => { copied = false; }, 2000);
	}

	function startFromEditor(fen: string) {
		mode = 'standard';
		engine.reset('standard', fen);
		gameState = engine.getState();
		stockfish?.newGame();
		view = 'play';

		if (opponent === 'ai' && gameState.turnColor !== playerColor) {
			makeAiMove();
		}
	}

	const promotionPieces = [
		{ role: 'queen' as const, symbol: '♛' },
		{ role: 'rook' as const, symbol: '♜' },
		{ role: 'bishop' as const, symbol: '♝' },
		{ role: 'knight' as const, symbol: '♞' }
	];

	function isMyTurn(): boolean {
		if (opponent === 'online') return gameState.turnColor === playerColor;
		if (opponent === 'ai') return gameState.turnColor === playerColor;
		return true;
	}
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

				<div class="opponent-select">
					<button class:active={opponent === 'local'} class="secondary" onclick={() => setOpponent('local')}>
						Local
					</button>
					<button class:active={opponent === 'ai'} class="secondary" onclick={() => setOpponent('ai')}>
						vs AI {#if !aiReady}(loading...){/if}
					</button>
					<button class:active={opponent === 'online'} class="secondary" onclick={() => setOpponent('online')}>
						Online
					</button>
				</div>

				<div class="actions">
					<button class="secondary" onclick={() => newGame()}>New Game</button>
					<button class="secondary" onclick={flipBoard}>Flip</button>
					<button class="secondary" onclick={takeBack} disabled={!engine.canUndo || aiThinking || resigned || gameState.isEnd || (opponent === 'online' && takebackRequested)}>
						{takebackRequested ? 'Requested...' : 'Take Back'}
					</button>
					<button class="secondary resign-btn" onclick={resign} disabled={gameState.isEnd || resigned || aiThinking}>
						Resign
					</button>
					{#if opponent === 'ai'}
						<button class="secondary" onclick={togglePlayerColor}>
							Play as {playerColor === 'white' ? 'Black' : 'White'}
						</button>
					{/if}
				</div>
			</div>

			<!-- Online Panel -->
			{#if opponent === 'online' && showOnlinePanel && !peerConnected}
				<div class="online-panel">
					<div class="online-section">
						<h3>Create a Game</h3>
						<button class="primary" onclick={createGame}>Create Game</button>
						{#if gameCode}
							<div class="game-code">
								<span>Code: <strong>{gameCode}</strong></span>
								<button class="secondary small" onclick={copyGameCode}>
									{copied ? 'Copied!' : 'Copy'}
								</button>
							</div>
							<p class="hint">Share this code with your friend</p>
						{/if}
					</div>
					<div class="divider">or</div>
					<div class="online-section">
						<h3>Join a Game</h3>
						<div class="join-form">
							<input
								type="text"
								bind:value={joinCode}
								placeholder="Enter game code"
								onkeydown={(e) => e.key === 'Enter' && joinGame()}
							/>
							<button class="primary" onclick={joinGame}>Join</button>
						</div>
					</div>
					{#if peerStatus}
						<p class="peer-status">{peerStatus}</p>
					{/if}
				</div>
			{/if}

			<!-- Takeback request popup -->
			{#if takebackIncoming}
				<div class="takeback-popup">
					<p>Opponent requests a take back</p>
					<div class="takeback-actions">
						<button class="primary" onclick={acceptTakeback}>Accept</button>
						<button class="secondary" onclick={denyTakeback}>Deny</button>
					</div>
				</div>
			{/if}

			{#if opponent === 'ai'}
				<div class="ai-controls">
					<span class="ai-label">Difficulty:</span>
					{#each skillPresets as preset, i}
						<button
							class="difficulty-btn"
							class:active={selectedPreset === i}
							onclick={() => setDifficulty(i)}
						>
							{preset.label}
						</button>
					{/each}
				</div>
			{/if}

			{#if opponent === 'online' && peerConnected}
				<div class="online-status connected">
					Connected — You play as {playerColor}
				</div>
			{/if}

			<div class="play-area">
				<div class="board-area">
					{#if aiThinking}
						<div class="thinking-bar">AI is thinking...</div>
					{/if}

					<ChessBoard
						bind:this={boardComponent}
						fen={gameState.fen}
						turnColor={gameState.turnColor}
						dests={(opponent !== 'local' && gameState.turnColor !== playerColor) ? new Map() : gameState.dests}
						lastMove={gameState.lastMove}
						isCheck={gameState.isCheck}
						orientation={opponent !== 'local' ? playerColor : 'white'}
						viewOnly={aiThinking || resigned || (opponent === 'online' && !peerConnected)}
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

				<GameInfo state={gameState} {resigned} resignedColor={opponent === 'local' ? gameState.turnColor : playerColor} />
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

	.tab:hover { color: #ccc; }
	.tab.active { background: var(--accent); color: white; }

	.game-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		width: 100%;
	}

	.controls {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.mode-select,
	.opponent-select,
	.actions {
		display: flex;
		gap: 0.4rem;
	}

	.ai-controls {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.ai-label {
		font-size: 0.85rem;
		color: #888;
		margin-right: 0.25rem;
	}

	.difficulty-btn {
		padding: 0.35rem 0.8rem;
		font-size: 0.8rem;
		background: #1e1e1e;
		color: #aaa;
		border-radius: 6px;
		border: 1px solid transparent;
		cursor: pointer;
		transition: all 0.15s;
	}

	.difficulty-btn:hover { border-color: #555; color: #ddd; }
	.difficulty-btn.active { background: var(--accent); color: white; border-color: var(--accent); }

	.play-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
	}

	.board-area { position: relative; }

	.thinking-bar {
		position: absolute;
		top: -2rem;
		left: 0;
		right: 0;
		text-align: center;
		font-size: 0.85rem;
		color: #aaa;
		padding: 0.3rem;
		background: #1e1e1e;
		border-radius: 6px;
		animation: pulse 1.5s ease-in-out infinite;
	}

	.resign-btn:not(:disabled):hover {
		background: #c62828 !important;
		color: white;
	}

	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.6; }
		50% { opacity: 1; }
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

	.promotion-dialog p { margin-bottom: 1rem; font-size: 1.1rem; }

	.promotion-pieces { display: flex; gap: 0.5rem; }

	.promotion-btn {
		font-size: 2.5rem;
		padding: 0.5rem 1rem;
		background: #1e1e1e;
		border-radius: 8px;
		color: white;
		border: 2px solid transparent;
		transition: border-color 0.15s;
	}

	.promotion-btn:hover { border-color: var(--accent); }

	/* Online Panel */
	.online-panel {
		background: #1e1e1e;
		border-radius: 12px;
		padding: 1.5rem;
		display: flex;
		gap: 1.5rem;
		align-items: center;
		flex-wrap: wrap;
		justify-content: center;
	}

	.online-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.online-section h3 {
		font-size: 1rem;
		color: #ccc;
		margin: 0;
	}

	.divider {
		color: #555;
		font-size: 0.9rem;
		font-style: italic;
	}

	.game-code {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #2a2a2a;
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		font-family: monospace;
		font-size: 1.1rem;
		color: #7c4dff;
	}

	.small {
		padding: 0.3rem 0.6rem;
		font-size: 0.75rem;
	}

	.hint {
		font-size: 0.8rem;
		color: #666;
	}

	.join-form {
		display: flex;
		gap: 0.5rem;
	}

	.join-form input {
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		color: #e0e0e0;
		font-size: 0.9rem;
		font-family: monospace;
		width: 160px;
	}

	.join-form input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.peer-status {
		font-size: 0.85rem;
		color: #aaa;
		text-align: center;
		width: 100%;
	}

	.online-status {
		font-size: 0.9rem;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		text-align: center;
	}

	.online-status.connected {
		background: #1b5e20;
		color: #a5d6a7;
	}

	.takeback-popup {
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 10px;
		padding: 1rem 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.takeback-popup p {
		font-size: 0.95rem;
		color: #e0e0e0;
	}

	.takeback-actions {
		display: flex;
		gap: 0.5rem;
	}

	@media (min-width: 768px) {
		.play-area {
			flex-direction: row;
			align-items: flex-start;
		}
	}
</style>
