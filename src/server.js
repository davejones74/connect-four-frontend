const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const ROWS = 6;
const COLS = 7;

let board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
let currentPlayer = "red";
let gameOver = false;

function checkWin(row, col, color) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of directions) {
        let count = 1;
        for (const sign of [1, -1]) {
            let r = row + dr * sign;
            let c = col + dc * sign;
            while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === color) {
                count++;
                r += dr * sign;
                c += dc * sign;
            }
        }
        if (count >= 4) return true;
    }
    return false;
}

function isBoardFull() {
    return board.every(row => row.every(cell => cell !== null));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.post("/api/make-move", (req, res) => {
    if (gameOver) {
        return res.status(400).json({ success: false, error: "Game is over, reset to play again" });
    }

    const { column } = req.body;
    if (typeof column !== "number" || !Number.isInteger(column) || column < 0 || column >= COLS) {
        return res.status(400).json({ success: false, error: "Invalid column" });
    }

    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][column] === null) {
            board[r][column] = currentPlayer;
            const color = currentPlayer;

            if (checkWin(r, column, color)) {
                gameOver = true;
                return res.json({ success: true, row: r, color, gameOver: true, winner: color });
            }

            if (isBoardFull()) {
                gameOver = true;
                return res.json({ success: true, row: r, color, gameOver: true, winner: null });
            }

            currentPlayer = currentPlayer === "red" ? "yellow" : "red";
            return res.json({ success: true, row: r, color, gameOver: false, winner: null });
        }
    }

    return res.status(400).json({ success: false, error: "Column is full" });
});

app.post("/api/reset", (req, res) => {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    currentPlayer = "red";
    gameOver = false;
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
