import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';

export type PeerMessage =
	| { type: 'move'; from: string; to: string; promotion?: string }
	| { type: 'resign' }
	| { type: 'takeback-request' }
	| { type: 'takeback-accept' }
	| { type: 'takeback-deny' }
	| { type: 'new-game' }
	| { type: 'chat'; text: string };

type MessageHandler = (msg: PeerMessage) => void;
type StatusHandler = (status: string) => void;

export class ChessPeer {
	private peer: Peer | null = null;
	private conn: DataConnection | null = null;
	private onMessage: MessageHandler = () => {};
	private onStatus: StatusHandler = () => {};
	private _gameId = '';
	private _isHost = false;

	get gameId(): string {
		return this._gameId;
	}

	get isHost(): boolean {
		return this._isHost;
	}

	get connected(): boolean {
		return this.conn?.open ?? false;
	}

	onMessageReceived(handler: MessageHandler) {
		this.onMessage = handler;
	}

	onStatusChange(handler: StatusHandler) {
		this.onStatus = handler;
	}

	createGame(): Promise<string> {
		return new Promise((resolve, reject) => {
			// Generate a short game ID
			const id = 'cf-' + Math.random().toString(36).substring(2, 8);
			this._gameId = id;
			this._isHost = true;

			this.peer = new Peer(id);

			this.peer.on('open', () => {
				this.onStatus('Waiting for opponent...');
				resolve(id);
			});

			this.peer.on('connection', (conn) => {
				this.conn = conn;
				this.setupConnection(conn);
			});

			this.peer.on('error', (err) => {
				this.onStatus(`Error: ${err.message}`);
				reject(err);
			});
		});
	}

	joinGame(gameId: string): Promise<void> {
		return new Promise((resolve, reject) => {
			this._gameId = gameId;
			this._isHost = false;

			this.peer = new Peer();

			this.peer.on('open', () => {
				this.onStatus('Connecting...');
				const conn = this.peer!.connect(gameId, { reliable: true });
				this.conn = conn;
				this.setupConnection(conn);

				conn.on('open', () => {
					resolve();
				});

				conn.on('error', (err) => {
					this.onStatus(`Connection error: ${err.message}`);
					reject(err);
				});
			});

			this.peer.on('error', (err) => {
				this.onStatus(`Error: ${err.message}`);
				reject(err);
			});
		});
	}

	private setupConnection(conn: DataConnection) {
		conn.on('open', () => {
			this.onStatus('Connected!');
		});

		conn.on('data', (data) => {
			this.onMessage(data as PeerMessage);
		});

		conn.on('close', () => {
			this.onStatus('Opponent disconnected');
			this.conn = null;
		});

		conn.on('error', (err) => {
			this.onStatus(`Connection error: ${err.message}`);
		});
	}

	send(msg: PeerMessage) {
		if (this.conn?.open) {
			this.conn.send(msg);
		}
	}

	disconnect() {
		this.conn?.close();
		this.peer?.destroy();
		this.conn = null;
		this.peer = null;
		this._gameId = '';
	}
}
