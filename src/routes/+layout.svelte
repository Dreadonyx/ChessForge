<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<div class="app">
	<header>
		<h1>ChessForge</h1>
	</header>
	<main>
		{@render children()}
	</main>
</div>

<style>
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	header {
		padding: 1rem 2rem;
		background: #1a1a1a;
		border-bottom: 1px solid #2a2a2a;
	}

	header h1 {
		font-size: 1.4rem;
		font-weight: 700;
		background: linear-gradient(135deg, #7c4dff, #448aff);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	main {
		flex: 1;
		padding: 2rem;
		display: flex;
		justify-content: center;
	}
</style>
