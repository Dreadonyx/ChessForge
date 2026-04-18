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

		requestAnimationFrame(() => {
			ground?.redrawAll();
		});
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
	});

	onDestroy(() => {
		ground?.destroy();
	});

	export function toggleOrientation() {
		ground?.toggleOrientation();
	}
</script>

<div class="board-container">
	<div class="board" bind:this={boardEl}></div>
</div>

<style>
	.board-container {
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
</style>
