const CELL_SIZE = 80; // Matches CSS --cell-size

const introScreen = document.getElementById('intro-screen');
const gameContainer = document.getElementById('game-container');
const piecesLayer = document.getElementById('pieces-layer');
const gameRow = document.getElementById('game-row');
const turnP1 = document.getElementById('turn-p1');
const turnP2 = document.getElementById('turn-p2');
const gameActions = document.getElementById('game-actions');
const resetBtn = document.getElementById('reset-btn');
const backBtn = document.getElementById('back-btn');
const startBtn = document.getElementById('start-btn');
const modeBadge = document.getElementById('mode-badge');
const gameTitle = document.getElementById('game-title');
const savedGamesList = document.getElementById('saved-games-list');
const savedGamesEmpty = document.getElementById('saved-games-empty');

const ROWS = 6;
const COLS = 7;
const EMPTY_BOARD = 'E'.repeat(ROWS * COLS);

let player1Type = 'HUMAN';
let player2Type = 'HUMAN';
let player1Level = 5;
let player2Level = 5;
let gameId = null;
let currentGame = null;
let board = EMPTY_BOARD;
let currentTurn = 1;
let status = 'IN_PROGRESS';
let winner = null;
let busy = false;
let generation = 0;

function cellAt(b, row, col) {
    return b.charAt(row * COLS + col);
}

function firstEmptyRow(b, col) {
    for (let row = ROWS - 1; row >= 0; row--) {
        if (cellAt(b, row, col) === 'E') {
            return row;
        }
    }
    return -1;
}

function setCell(b, row, col, piece) {
    const i = row * COLS + col;
    return b.slice(0, i) + piece + b.slice(i + 1);
}

function checkWin(b, row, col, piece) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of directions) {
        let count = 1;
        for (const sign of [1, -1]) {
            let r = row + dr * sign;
            let c = col + dc * sign;
            while (r >= 0 && r < ROWS && c >= 0 && c < COLS && cellAt(b, r, c) === piece) {
                count++;
                r += dr * sign;
                c += dc * sign;
            }
        }
        if (count >= 4) {
            return true;
        }
    }
    return false;
}

function spawnPiece(column, row, color, animate = true) {
    const piece = document.createElement('div');
    piece.classList.add('piece', color);
    piece.style.left = `${column * CELL_SIZE}px`;
    const destinationY = row * CELL_SIZE;
    piece.style.setProperty('--drop-destination', `${destinationY}px`);
    if (!animate) {
        piece.style.animation = 'none';
        piece.style.transform = `translateY(${destinationY}px)`;
    }
    piecesLayer.appendChild(piece);

    if (animate) {
        Sound.drop();
    }
}

async function api(path, options = {}) {
    const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || `Request failed (${res.status})`);
    }
    return data;
}

function buildGameRequest() {
    return {
        gameType: (player1Type === 'HUMAN' && player2Type === 'HUMAN') ? 'HUMAN_VS_HUMAN' : 'HUMAN_VS_AI',
        player1Name: 'Player 1',
        player2Name: 'Player 2',
        player1Type,
        player2Type,
        player1AiLevel: player1Type === 'AI' ? `A${player1Level}` : null,
        player2AiLevel: player2Type === 'AI' ? `A${player2Level}` : null,
        currentTurn: 1,
        winner: 0,
        status: 'IN_PROGRESS'
    };
}

function buildRequestFromGame(game) {
    return {
        gameType: game.gameType,
        player1Name: game.player1Name,
        player2Name: game.player2Name,
        player1Type: game.player1Type,
        player2Type: game.player2Type,
        player1AiLevel: game.player1AiLevel,
        player2AiLevel: game.player2AiLevel,
        currentTurn: game.currentTurn ?? 1,
        winner: game.winner ?? 0
    };
}

function playerLabel(type, level) {
    if (type !== 'AI') return 'Human';
    const digits = String(level ?? '').replace(/\D/g, '');
    return `AI ${digits || '5'}`;
}

function matchupLabel() {
    return `${playerLabel(player1Type, player1Level)} vs ${playerLabel(player2Type, player2Level)}`;
}

function updateTurnIndicators() {
    const p1Avatar = turnP1.querySelector('.turn-avatar');
    const p1Label = turnP1.querySelector('.turn-label');
    const p2Avatar = turnP2.querySelector('.turn-avatar');
    const p2Label = turnP2.querySelector('.turn-label');

    p1Avatar.textContent = player1Type === 'AI' ? '🤖' : '🧑';
    p1Label.textContent = playerLabel(player1Type, player1Level);
    p2Avatar.textContent = player2Type === 'AI' ? '🤖' : '🧑';
    p2Label.textContent = playerLabel(player2Type, player2Level);

    const activePanel = currentTurn === 1 ? turnP1 : turnP2;
    turnP1.classList.toggle('active', currentTurn === 1);
    turnP2.classList.toggle('active', currentTurn === 2);
}

function isHumanTurn() {
    if (!currentGame) return false;
    return currentTurn === 1
        ? currentGame.player1Type === 'HUMAN'
        : currentGame.player2Type === 'HUMAN';
}

function isAiTurn() {
    if (!currentGame) return false;
    return currentTurn === 1
        ? currentGame.player1Type === 'AI'
        : currentGame.player2Type === 'AI';
}

async function deleteCurrentGame() {
    if (!gameId) return;
    try {
        await api(`/api/games/${gameId}`, { method: 'DELETE' });
    } catch (_) {
        // Ignore cleanup failures
    }
    gameId = null;
}

async function startNewGame() {
    generation++;
    const gen = generation;
    busy = false;

    const game = await api('/api/games', {
        method: 'POST',
        body: JSON.stringify(buildGameRequest())
    });
    if (gen !== generation) return;

    await api(`/api/games/${game.id}/board`, {
        method: 'POST',
        body: JSON.stringify({ board: EMPTY_BOARD })
    });
    if (gen !== generation) return;

    gameId = game.id;
    currentGame = game;
    board = EMPTY_BOARD;
    currentTurn = 1;
    status = 'IN_PROGRESS';
    winner = null;
    piecesLayer.innerHTML = '';

    updateTurnIndicators();

    if (isAiTurn()) {
        setTimeout(() => aiMove(gen), 500);
    }
}

async function humanMove(column) {
    if (busy || status !== 'IN_PROGRESS' || !isHumanTurn()) return;

    const row = firstEmptyRow(board, column);
    if (row < 0) return;

    const gen = generation;
    const piece = currentTurn === 1 ? 'R' : 'Y';
    busy = true;

    try {
        board = setCell(board, row, column, piece);
        spawnPiece(column, row, piece === 'R' ? 'red' : 'yellow');

        const won = checkWin(board, row, column, piece);
        const draw = !won && board.indexOf('E') === -1;

        let newWinner = 0;
        if (won) {
            status = 'COMPLETED';
            winner = currentTurn;
            newWinner = currentTurn;
        } else if (draw) {
            status = 'COMPLETED';
            winner = 0;
        } else {
            currentTurn = currentTurn === 1 ? 2 : 1;
            updateTurnIndicators();
        }

        const request = buildRequestFromGame(currentGame);
        request.currentTurn = currentTurn;
        request.winner = newWinner;
        request.status = status;

        await api(`/api/games/${gameId}/board`, {
            method: 'PUT',
            body: JSON.stringify({ board })
        });
        if (gen !== generation) return;

        await api(`/api/games/${gameId}`, {
            method: 'PUT',
            body: JSON.stringify(request)
        });
        if (gen !== generation) return;

        if (status === 'COMPLETED') {
            setTimeout(() => showResult(winner), 700);
            return;
        }
        if (isAiTurn()) {
            setTimeout(() => aiMove(gen), 600);
        }
    } catch (err) {
        alert(err.message);
    } finally {
        busy = false;
    }
}

async function aiMove(gen) {
    if (gen !== generation || busy || status !== 'IN_PROGRESS' || !isAiTurn()) return;

    busy = true;
    try {
        const prevBoard = board;
        const resp = await api(`/api/games/${gameId}/next-move`, { method: 'POST' });
        if (gen !== generation) return;

        const column = resp.column - 1;
        let row = -1;
        for (let r = 0; r < ROWS; r++) {
            if (resp.board.charAt(r * COLS + column) !== prevBoard.charAt(r * COLS + column)) {
                row = r;
                break;
            }
        }
        const piece = currentTurn === 1 ? 'R' : 'Y';

        board = resp.board;
        status = resp.status;
        winner = resp.winner ?? null;
        currentTurn = resp.currentTurn ?? null;

        updateTurnIndicators();

        spawnPiece(column, row, piece === 'R' ? 'red' : 'yellow');

        if (status !== 'IN_PROGRESS') {
            setTimeout(() => showResult(winner), 700);
            return;
        }
        if (isAiTurn()) {
            setTimeout(() => aiMove(gen), 700);
        }
    } catch (err) {
        alert('AI move failed: ' + err.message);
    } finally {
        busy = false;
    }
}

function showResult(win) {
    if (win !== 0) {
        Sound.victory();
    }
    const message = win === 0 ? 'Draw!' : `Player ${win} wins!`;
    alert(message);
}

function renderBoardState(boardString) {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const cell = boardString.charAt(row * COLS + col);
            if (cell === 'R') {
                spawnPiece(col, row, 'red', false);
            } else if (cell === 'Y') {
                spawnPiece(col, row, 'yellow', false);
            }
        }
    }
}

async function resumeGame(id) {
    generation++;
    const gen = generation;
    busy = false;

    try {
        const game = await api(`/api/games/${id}`);
        if (gen !== generation) return;
        if (game.status !== 'IN_PROGRESS') {
            await loadSavedGames();
            return;
        }

        const boardResp = await api(`/api/games/${id}/board`);
        if (gen !== generation) return;

        gameId = game.id;
        currentGame = game;
        board = boardResp.board;
        currentTurn = game.currentTurn ?? 1;
        status = game.status;
        winner = game.winner ?? null;
        player1Type = game.player1Type;
        player2Type = game.player2Type;
        player1Level = Number(String(game.player1AiLevel ?? '').replace(/\D/g, '')) || 5;
        player2Level = Number(String(game.player2AiLevel ?? '').replace(/\D/g, '')) || 5;

        piecesLayer.innerHTML = '';
        renderBoardState(board);

        modeBadge.textContent = matchupLabel();
        updateTurnIndicators();

        introScreen.classList.add('hidden');
        gameTitle.classList.remove('hidden');
        gameRow.classList.remove('hidden');
        gameActions.classList.remove('hidden');
        modeBadge.classList.remove('hidden');

        if (isAiTurn()) {
            setTimeout(() => aiMove(gen), 700);
        }
    } catch (err) {
        alert(err.message);
    }
}

function buildGameCard(game) {
    const card = document.createElement('div');
    card.className = 'saved-game-card';

    const info = document.createElement('div');
    info.className = 'saved-game-info';

    const name = document.createElement('div');
    name.className = 'saved-game-name';
    name.textContent = `Game #${game.id}`;

    const matchup = document.createElement('div');
    matchup.className = 'saved-game-detail';
    matchup.textContent = `${playerLabel(game.player1Type, game.player1AiLevel)} vs ${playerLabel(game.player2Type, game.player2AiLevel)}`;

    const turn = document.createElement('div');
    turn.className = 'saved-game-detail';
    turn.textContent = `Player ${game.currentTurn ?? 1} to move`;

    const lastPlayed = document.createElement('div');
    lastPlayed.className = 'saved-game-detail';
    lastPlayed.textContent = `Last played ${game.updatedAt ? new Date(game.updatedAt).toLocaleString() : 'Unknown'}`;

    info.append(name, matchup, turn, lastPlayed);

    const actions = document.createElement('div');
    actions.className = 'saved-game-actions';

    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'resume-btn';
    resumeBtn.textContent = 'Resume';
    resumeBtn.addEventListener('click', () => resumeGame(game.id));

    const archiveBtn = document.createElement('button');
    archiveBtn.className = 'archive-btn';
    archiveBtn.textContent = 'Archive';
    archiveBtn.addEventListener('click', () => archiveGame(game.id));

    actions.append(resumeBtn, archiveBtn);
    card.append(info, actions);
    return card;
}

async function loadSavedGames() {
    let games;
    try {
        games = await api('/api/games');
    } catch (err) {
        savedGamesEmpty.textContent = 'Could not load saved games';
        savedGamesEmpty.classList.remove('hidden');
        savedGamesList.innerHTML = '';
        return;
    }

    const resumable = games.filter(g => g.status === 'IN_PROGRESS');
    savedGamesList.innerHTML = '';

    if (resumable.length === 0) {
        savedGamesEmpty.textContent = 'No saved games yet';
        savedGamesEmpty.classList.remove('hidden');
        return;
    }

    savedGamesEmpty.classList.add('hidden');
    resumable.forEach(game => savedGamesList.appendChild(buildGameCard(game)));
}

async function archiveGame(id) {
    try {
        await api(`/api/games/${id}/archive`, { method: 'PATCH' });
        await loadSavedGames();
    } catch (err) {
        alert(err.message);
    }
}

gameContainer.addEventListener('click', (e) => {
    if (busy || status !== 'IN_PROGRESS' || !isHumanTurn()) return;
    const rect = gameContainer.getBoundingClientRect();
    const column = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    if (column < 0 || column >= COLS) return;
    humanMove(column);
});

async function resetBoard() {
    piecesLayer.innerHTML = '';
    modeBadge.textContent = matchupLabel();
    await startNewGame();
}

function initPlayerSetup() {
    document.querySelectorAll('.player-panel').forEach(panel => {
        const playerNum = Number(panel.dataset.player);
        const typeSelector = panel.querySelector('.type-selector');
        const levelSelector = panel.querySelector('.level-selector');

        typeSelector.addEventListener('click', (e) => {
            const btn = e.target.closest('.type-btn');
            if (!btn) return;
            typeSelector.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            if (playerNum === 1) {
                player1Type = btn.dataset.type;
            } else {
                player2Type = btn.dataset.type;
            }
            levelSelector.classList.toggle('hidden', btn.dataset.type !== 'AI');
        });

        for (let i = 1; i <= 10; i++) {
            const btn = document.createElement('button');
            btn.className = 'level-btn';
            btn.textContent = i;
            btn.dataset.level = i;
            if (i === (playerNum === 1 ? player1Level : player2Level)) {
                btn.classList.add('selected');
            }
            btn.addEventListener('click', () => {
                levelSelector.querySelectorAll('.level-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                if (playerNum === 1) {
                    player1Level = i;
                } else {
                    player2Level = i;
                }
            });
            levelSelector.appendChild(btn);
        }
    });
}

async function startGame() {
    Sound.unlock();
    await resetBoard();
    introScreen.classList.add('hidden');
    gameTitle.classList.remove('hidden');
    gameRow.classList.remove('hidden');
    gameActions.classList.remove('hidden');
    modeBadge.classList.remove('hidden');
    Sound.welcome();
}

async function goBack() {
    generation++;
    busy = false;
    if (gameId && board === EMPTY_BOARD) {
        await deleteCurrentGame();
    }
    piecesLayer.innerHTML = '';
    gameId = null;
    currentGame = null;
    board = EMPTY_BOARD;
    currentTurn = 1;
    status = 'IN_PROGRESS';
    winner = null;
    introScreen.classList.remove('hidden');
    gameTitle.classList.add('hidden');
    gameRow.classList.add('hidden');
    gameActions.classList.add('hidden');
    modeBadge.classList.add('hidden');
    await loadSavedGames();
}

startBtn.addEventListener('click', startGame);
backBtn.addEventListener('click', goBack);
resetBtn.addEventListener('click', resetBoard);

initPlayerSetup();
loadSavedGames();
