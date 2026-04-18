<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chessground } from '@lichess-org/chessground';
	import type { Api } from '@lichess-org/chessground/api';
	import type { Key, Color as CgColor } from '@lichess-org/chessground/types';

	interface Props {
		fen: string;
		turnColor: 'white' | 'black';
		dests: Map<Key, Key[]>;
		lastMove?: [Key, Key];
		isCheck?: boolean;
		orientation?: 'white' | 'black';
		viewOnly?: boolean;
		onMove?: (from: Key, to: Key) => void;
	}

	let {
		fen,
		turnColor,
		dests,
		lastMove,
		isCheck = false,
		orientation = 'white',
		viewOnly = false,
		onMove
	}: Props = $props();

	let boardEl: HTMLDivElement;
	let ground: Api | undefined = $state(undefined);
	let prevFen = '';

	let resizeHandler: (() => void) | undefined;

	onMount(() => {
		const setPixelPerfectSize = () => {
			const maxSize = Math.min(window.innerWidth * 0.9, 560);
			const size = Math.floor(maxSize / 8) * 8;
			boardEl.style.width = size + 'px';
			boardEl.style.height = size + 'px';
		};
		setPixelPerfectSize();
		resizeHandler = setPixelPerfectSize;
		window.addEventListener('resize', setPixelPerfectSize);

		ground = Chessground(boardEl, {
			fen,
			orientation,
			turnColor: turnColor as CgColor,
			check: isCheck ? turnColor as CgColor : false,
			lastMove: lastMove as Key[] | undefined,
			coordinates: true,
			movable: {
				free: false,
				color: viewOnly ? undefined : turnColor as CgColor,
				dests,
				showDests: true
			},
			draggable: { enabled: true },
			animation: { enabled: true, duration: 200 },
			highlight: { lastMove: true, check: true },
			premovable: { enabled: false },
			events: {
				move: (orig: Key, dest: Key) => {
					// After user move, chessground already moved the piece visually.
					// Store current fen so we can skip the redundant fen update in $effect.
					prevFen = '';
					onMove?.(orig, dest);
				}
			}
		});
		prevFen = fen;

		requestAnimationFrame(() => {
			ground?.redrawAll();
		});
	});

	$effect(() => {
		if (!ground) return;

		// Read all props to track them
		const newFen = fen;
		const newTurn = turnColor as CgColor;
		const newCheck = isCheck;
		const newLastMove = lastMove;
		const newDests = dests;
		const newViewOnly = viewOnly;
		const newOrientation = orientation;

		// Only set fen if it actually changed from an external source (AI move, new game)
		// Skip if it changed because of the user's own move (chessground already handled it)
		const fenChanged = newFen !== prevFen;
		prevFen = newFen;

		const config: any = {
			orientation: newOrientation,
			turnColor: newTurn,
			check: newCheck ? newTurn : false,
			lastMove: newLastMove as Key[] | undefined,
			movable: {
				free: false,
				color: newViewOnly ? undefined : newTurn,
				dests: newDests,
				showDests: true
			}
		};

		if (fenChanged) {
			config.fen = newFen;
		}

		ground.set(config);
	});

	onDestroy(() => {
		if (resizeHandler) window.removeEventListener('resize', resizeHandler);
		ground?.destroy();
	});

	export function toggleOrientation() {
		ground?.toggleOrientation();
	}
</script>

<div class="board-container" bind:this={boardEl}></div>

<style>
	.board-container {
		width: 560px;
		height: 560px;
		max-width: 90vw;
		max-height: 90vw;
		display: block;
		position: relative;
	}
</style>
