const CELL_SIZE = 80; // Matches CSS --cell-size

const introScreen = document.getElementById('intro-screen');
const gameContainer = document.getElementById('game-container');
const piecesLayer = document.getElementById('pieces-layer');
const gameActions = document.getElementById('game-actions');
const resetBtn = document.getElementById('reset-btn');
const backBtn = document.getElementById('back-btn');
const startBtn = document.getElementById('start-btn');
const modeSelector = document.getElementById('mode-selector');
const modeBadge = document.getElementById('mode-badge');

const MODE_LABELS = {
    hh: 'Human vs Human',
    hc: 'Human vs Computer',
    ch: 'Computer vs Human',
    cc: 'Computer vs Computer'
};

let gameMode = 'hh';

// Example function to drop a piece into a specific column and row
function spawnPiece(column, row, color) {
    const piece = document.createElement('div');

    // Add classes for styling and color
    piece.classList.add('piece', color);

    // Calculate horizontal positioning
    piece.style.left = `${column * CELL_SIZE}px`;

    // Calculate exactly how far down the piece must slide
    const destinationY = row * CELL_SIZE;
    piece.style.setProperty('--drop-destination', `${destinationY}px`);

    // Inject the piece into the middle layer
    piecesLayer.appendChild(piece);
}

async function makeMove(column) {
    const res = await fetch('/api/make-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column })
    });
    const data = await res.json();

    if (data.success) {
        spawnPiece(column, data.row, data.color);
        if (data.gameOver) {
            const message = data.winner ? `${data.winner} wins!` : 'Draw!';
            setTimeout(() => alert(message), 700);
        }
    } else {
        alert(data.error || 'Invalid move');
    }
}

gameContainer.addEventListener('click', (e) => {
    const rect = gameContainer.getBoundingClientRect();
    const column = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    makeMove(column);
});

async function resetBoard() {
    await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: gameMode })
    });
    piecesLayer.innerHTML = '';
    modeBadge.dataset.mode = gameMode;
    modeBadge.textContent = MODE_LABELS[gameMode] || gameMode;
}

modeSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.mode-btn');
    if (!btn) return;
    modeSelector.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    gameMode = btn.dataset.mode;
});

async function startGame() {
    await resetBoard();
    introScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    gameActions.classList.remove('hidden');
    modeBadge.classList.remove('hidden');
}

async function goBack() {
    await resetBoard();
    piecesLayer.innerHTML = '';
    introScreen.classList.remove('hidden');
    gameContainer.classList.add('hidden');
    gameActions.classList.add('hidden');
    modeBadge.classList.add('hidden');
}

startBtn.addEventListener('click', startGame);

backBtn.addEventListener('click', goBack);

resetBtn.addEventListener('click', resetBoard);
