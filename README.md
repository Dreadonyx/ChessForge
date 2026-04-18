# ChessForge

A chess platform with a built-in board editor, multiple themes, and Chess960 support — built for creating and playing custom positions.

## Features

- **Standard Chess** — Full rules with move validation, check/checkmate/stalemate detection
- **Chess960 (Fischer Random)** — 960 randomized starting positions with correct castling
- **Board Editor** — Place pieces freely, validate positions, and play from custom setups
- **Theme Switcher** — 22 piece sets and 16 board themes from Lichess
- **Local Play** — Two players on the same device

## Roadmap

- [ ] AI opponent (Fairy-Stockfish WASM)
- [ ] P2P multiplayer via WebRTC (no server needed)
- [ ] Chess variants (King of the Hill, Racing Kings, Three-check, Antichess, Crazyhouse)
- [ ] Custom variant editor (define pieces, rules, win conditions)
- [ ] Online multiplayer with game rooms
- [ ] Variant sharing via URL

## Tech Stack

- **Frontend**: SvelteKit + TypeScript
- **Board UI**: [@lichess-org/chessground](https://github.com/lichess-org/chessground)
- **Chess Logic**: [chessops](https://github.com/niklasf/chessops)

## Getting Started

```bash
# Clone
git clone https://github.com/Dreadonyx/ChessForge.git
cd ChessForge

# Install
npm install

# Dev server
npm run dev

# Build
npm run build
```

## License

MIT
