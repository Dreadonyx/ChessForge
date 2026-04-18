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
					onMove?.(orig, dest);
				}
			}
		});

		// Redraw after a frame to ensure correct dimensions
		requestAnimationFrame(() => {
			ground?.redrawAll();
		});
	});

	$effect(() => {
		if (!ground) return;

		const cfg: Parameters<Api['set']>[0] = {
			fen,
			orientation,
			turnColor: turnColor as CgColor,
			check: isCheck ? turnColor as CgColor : false,
			lastMove: lastMove as Key[] | undefined,
			movable: {
				free: false,
				color: viewOnly ? undefined : turnColor as CgColor,
				dests,
				showDests: true
			}
		};

		ground.set(cfg);
	});

	onDestroy(() => {
		ground?.destroy();
	});

	export function toggleOrientation() {
		ground?.toggleOrientation();
	}
</script>

<div class="board-container" bind:this={boardEl}></div>

<style>
	.board-container {
		width: min(90vw, 560px);
		height: min(90vw, 560px);
		display: block;
		position: relative;
	}
</style>
