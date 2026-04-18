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

	let containerEl: HTMLDivElement;
	let boardEl: HTMLDivElement;
	let ground: Api | undefined = $state(undefined);
	let prevFen = '';
	let resizeObserver: ResizeObserver | undefined;

	function recalcBounds() {
		ground?.redrawAll();
		document.body.dispatchEvent(new Event('chessground.resize'));
	}

	onMount(() => {
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
					prevFen = '';
					onMove?.(orig, dest);
				}
			}
		});
		prevFen = fen;

		// ResizeObserver recalculates bounds whenever board size changes
		resizeObserver = new ResizeObserver(() => {
			recalcBounds();
		});
		resizeObserver.observe(containerEl);

		// Also recalc after delays to catch late layout shifts
		setTimeout(recalcBounds, 50);
		setTimeout(recalcBounds, 200);
		setTimeout(recalcBounds, 500);
	});

	$effect(() => {
		if (!ground) return;

		const newFen = fen;
		const newTurn = turnColor as CgColor;
		const newCheck = isCheck;
		const newLastMove = lastMove;
		const newDests = dests;
		const newViewOnly = viewOnly;
		const newOrientation = orientation;

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

		if (fenChanged) {
			requestAnimationFrame(recalcBounds);
		}
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		ground?.destroy();
	});

	export function toggleOrientation() {
		ground?.toggleOrientation();
	}
</script>

<div class="board-container" bind:this={containerEl}>
	<div class="board" bind:this={boardEl}></div>
</div>

<style>
	.board-container {
		width: min(90vw, 560px);
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
</style>
