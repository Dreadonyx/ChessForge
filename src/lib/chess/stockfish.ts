type MessageCallback = (line: string) => void;

export class StockfishEngine {
	private worker: Worker | null = null;
	private listeners: MessageCallback[] = [];

	async init(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.worker = new Worker('/stockfish/stockfish-18-lite-single.js');

			this.worker.onmessage = (event: MessageEvent) => {
				const line: string = typeof event.data === 'string' ? event.data : String(event);
				this.listeners.forEach((cb) => cb(line));
			};

			this.worker.onerror = (err) => {
				reject(new Error(`Stockfish worker error: ${err.message}`));
			};

			const initListener = (line: string) => {
				if (line === 'uciok') {
					this.removeListener(initListener);
					resolve();
				}
			};
			this.addListener(initListener);
			this.worker.postMessage('uci');
		});
	}

	send(command: string): void {
		this.worker?.postMessage(command);
	}

	addListener(cb: MessageCallback): void {
		this.listeners.push(cb);
	}

	removeListener(cb: MessageCallback): void {
		this.listeners = this.listeners.filter((l) => l !== cb);
	}

	setSkillLevel(level: number): void {
		const clamped = Math.max(0, Math.min(20, level));
		this.send(`setoption name Skill Level value ${clamped}`);
	}

	getBestMove(fen: string, depth = 12): Promise<string> {
		return new Promise((resolve) => {
			const listener = (line: string) => {
				if (line.startsWith('bestmove')) {
					this.removeListener(listener);
					const match = line.match(/^bestmove\s(\S+)/);
					resolve(match ? match[1] : '');
				}
			};
			this.addListener(listener);
			this.send(`position fen ${fen}`);
			this.send(`go depth ${depth}`);
		});
	}

	newGame(): void {
		this.send('ucinewgame');
	}

	stop(): void {
		this.send('stop');
	}

	destroy(): void {
		this.worker?.terminate();
		this.worker = null;
		this.listeners = [];
	}
}
