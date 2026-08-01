# Connect 4

A classic two-player Connect 4 game built with Node.js and Express. Players take turns dropping colored discs into a 7-column, 6-row board, competing to be the first to align four discs in a row — horizontally, vertically, or diagonally.

## Features

- Flashy animated intro screen with a rainbow-glow title and welcome text
- Three-layer board rendering (background, pieces, foreground grid) for a clean "disc in slot" effect
- Smooth physics-style drop animation with a bounce
- Glossy, gradient-styled game pieces
- Fully backend-driven game logic: moves are validated on the server, which tracks the board, turns, win conditions, and draws
- Full-screen background image behind the board

## Tech Stack

- **Node.js** — JavaScript runtime
- **Express 5** — HTTP server and static file serving
- **Vanilla HTML/CSS/JS** — frontend rendering and animations (no frontend frameworks)

## Project Structure

```
├── src/
│   └── server.js              # Express server, board state, and game API
├── public/
│   ├── index.html             # Intro screen + 3-layer board markup
│   ├── css/style.css          # Layout, intro animation, drop animation
│   ├── js/game.js             # Client logic: clicks, spawnPiece, API calls
│   ├── connect4-grid.svg      # Foreground grid with transparent holes
│   └── images/
│       └── board-background.png  # Page background image
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)

### Installation

```bash
npm install
```

### Running the Server

```bash
npm start
```

Then open http://localhost:3000 in your browser.

The server listens on the port set by the `PORT` environment variable, defaulting to `3000`.

## How It Works

1. The player clicks a column on the board.
2. The client sends a `POST /api/make-move` request with the chosen column.
3. The server finds the lowest available row in that column, places the current player's disc, and checks for a win or draw.
4. The server returns the result — including the row the disc landed in and the current color.
5. The client animates the disc dropping to that position with `spawnPiece()`.

### API Endpoints

| Method | Endpoint         | Description                                        |
|--------|------------------|----------------------------------------------------|
| POST   | `/api/make-move` | Body: `{ "column": 0-6 }`. Places a disc for the current player, returns the result. |
| POST   | `/api/reset`     | Resets the board, turn order, and game-over state. |

`make-move` returns JSON in the form:

```json
{ "success": true, "row": 5, "color": "red", "gameOver": false, "winner": null }
```

- `success` — whether the move was valid
- `row` — the row the disc settled into
- `color` — the color that moved (`red` or `yellow`)
- `gameOver` — whether the game has ended
- `winner` — the winning color, or `null` for a draw / game in progress

## Customisation

- **Cell size**: adjust `--cell-size` in `public/css/style.css` (and keep `CELL_SIZE` in `public/js/game.js` in sync).
- **Foreground grid**: replace `public/connect4-grid.svg` with your own transparent grid image (referenced in `public/index.html`).
- **Page background**: swap `public/images/board-background.png` for your own image.
