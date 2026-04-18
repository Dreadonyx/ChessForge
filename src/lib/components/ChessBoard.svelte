<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chessground } from '@lichess-org/chessground';
	import type { Api } from '@lichess-org/chessground/api';
	import type { Key, Color as CgColor, Piece as CgPiece } from '@lichess-org/chessground/types';
	import type { Role } from 'chessops/types';

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
	let ground: Api | undefined;

	onMount(() => {
		ground = Chessground(boardEl, {
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
	});

	$effect(() => {
		if (!ground) return;
		ground.set({
			fen,
			turnColor: turnColor as CgColor,
			check: isCheck ? turnColor as CgColor : false,
			lastMove: lastMove as Key[] | undefined,
			movable: {
				color: viewOnly ? undefined : turnColor as CgColor,
				dests
			}
		});
	});

	onDestroy(() => {
		ground?.destroy();
	});

	export function toggleOrientation() {
		ground?.toggleOrientation();
	}
</script>

<div class="board-wrap">
	<div class="board" bind:this={boardEl}></div>
</div>

<style>
	.board-wrap {
		width: min(90vw, 560px);
		aspect-ratio: 1;
	}
	.board {
		width: 100%;
		height: 100%;
	}
</style>
