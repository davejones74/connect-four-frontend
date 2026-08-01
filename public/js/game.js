const CELL_SIZE = 80; // Matches CSS --cell-size

const introScreen = document.getElementById('intro-screen');
const gameContainer = document.getElementById('game-container');
const piecesLayer = document.getElementById('pieces-layer');
const resetBtn = document.getElementById('reset-btn');
const startBtn = document.getElementById('start-btn');

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

async function startGame() {
    await fetch('/api/reset', { method: 'POST' });
    piecesLayer.innerHTML = '';
    introScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    resetBtn.classList.remove('hidden');
}

startBtn.addEventListener('click', startGame);

resetBtn.addEventListener('click', async () => {
    await fetch('/api/reset', { method: 'POST' });
    piecesLayer.innerHTML = '';
});
