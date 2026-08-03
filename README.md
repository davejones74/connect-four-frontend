# Connect 4

A classic two-player Connect 4 game built with Node.js and Express. Players take turns dropping colored discs into a 7-column, 6-row board, competing to be the first to align four discs in a row — horizontally, vertically, or diagonally.

## Features

- Flashy animated intro screen with a rainbow-glow title and welcome text
- Three-layer board rendering (background, pieces, foreground grid) for a clean "disc in slot" effect
- Smooth physics-style drop animation with a bounce
- Glossy, gradient-styled game pieces
- Fully backend-driven game logic: moves are validated on the server, which tracks the board, turns, win conditions, and draws
- Per-player setup: choose **Human** or **AI** independently for Player 1 and Player 2, with an AI difficulty level (1–10) per AI player
- Saved games: in-progress games persist in the backend and can be resumed (board preloaded) or archived from the start screen; each card shows the matchup and last-played time
- Full-screen background image behind the board

## Tech Stack

- **Node.js** — JavaScript runtime
- **Express 5** — HTTP server and static file serving
- **Vanilla HTML/CSS/JS** — frontend rendering and animations (no frontend frameworks)

## Project Structure

```
├── src/
│   └── server.js              # Express server: static files + /api proxy to the Java backend
├── public/
│   ├── index.html             # Intro screen + 3-layer board markup
│   ├── css/style.css          # Layout, intro animation, drop animation
│   ├── js/game.js             # Client logic: clicks, spawnPiece, backend API calls
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

### Prerequisite: Java Backend

The AI players rely on the Connect4 Java backend, which must be running and reachable on `http://localhost:8080` (see the `Connect4Backend` repository). Every `/api/*` request from the browser is proxied to the backend by the Express server. Point the proxy elsewhere with the `BACKEND_URL` environment variable if needed:

```bash
$env:BACKEND_URL="http://localhost:8080"; npm start
```

## How It Works

1. On start, the client reads the Player 1 / Player 2 selections (Human or AI, plus AI level 1–10), creates a game (`POST /api/games`) with the matching player types and AI levels (`A1`–`A10`), then adds an empty 42-cell board (`POST /api/games/{gameId}/board`).
2. A human clicks a column; the client finds the lowest free row, checks for a win/draw, and persists the board (`PUT /api/games/{gameId}/board`) and turn state (`PUT /api/games/{gameId}`).
3. When it is an AI player's turn, the client calls `POST /api/games/{gameId}/next-move`, which plays the move server-side and returns the updated board.
4. The client renders each disc from the 42-character board string (`E` empty, `R` red/player 1, `Y` yellow/player 2, row-major top-to-bottom) with `spawnPiece()`.

### Saved Games

The start screen lists every game still in progress (`GET /api/games`, filtered to `status == "IN_PROGRESS"`), showing the matchup (e.g. `Human vs AI 5`) and last-played time.

- **Resume** loads the game (`GET /api/games/{id}`) and its board (`GET /api/games/{id}/board`), renders the existing discs without animation, and picks up from the saved turn — including letting the AI play if it's an AI's turn.
- **Archive** marks the game as `ARCHIVED` (`PATCH /api/games/{id}/archive`), removing it from the list while keeping it in the database.
- Leaving a game via **Back** keeps it (if moves were played) so it can be resumed later; untouched games are cleaned up. **Reset** starts a brand-new game.

### API Endpoints

The Express server proxies all `/api` requests to the Java backend. The backend's endpoints (see its Swagger UI at `/swagger-ui/index.html`) include:

| Method | Endpoint                          | Description                                    |
|--------|-----------------------------------|------------------------------------------------|
| POST   | `/api/games`                      | Create a game from a `GameRequest`.            |
| GET    | `/api/games`                      | List all games.                                |
| GET    | `/api/games/{id}`                 | Get a game by id.                              |
| PUT    | `/api/games/{id}`                 | Update a game (turn/winner state).             |
| DELETE | `/api/games/{id}`                 | Delete a game and its gameboard.               |
| PATCH  | `/api/games/{id}/archive`         | Archive a game.                                |
| POST   | `/api/games/{id}/next-move`       | Let the AI player make the next move.          |
| POST   | `/api/games/{gameId}/board`       | Add a gameboard to a game.                     |
| PUT    | `/api/games/{gameId}/board`       | Update the gameboard of a game.                |
| GET    | `/api/games/{gameId}/board`       | Get the gameboard of a game.                   |

`next-move` returns JSON in the form:

```json
{ "gameId": 1, "column": 4, "board": "EE...ERY...", "currentTurn": 2, "winner": 0, "status": "IN_PROGRESS", "moveNumber": 1 }
```

- `column` — the 1-indexed column the AI disc landed in
- `board` — the full 42-character board after the move (`E`/`R`/`Y`, row-major)
- `currentTurn` — the next player (1 or 2), or `null` when the game has ended
- `winner` — `0` for a draw/in-progress, or the winning player (1 or 2)
- `status` — `IN_PROGRESS`, `COMPLETED` or `ARCHIVED`
- `moveNumber` — how many moves have been played

## Customisation

- **Cell size**: adjust `--cell-size` in `public/css/style.css` (and keep `CELL_SIZE` in `public/js/game.js` in sync).
- **Foreground grid**: replace `public/connect4-grid.svg` with your own transparent grid image (referenced in `public/index.html`).
- **Page background**: swap `public/images/board-background.png` for your own image.
