import { Chessground } from 'https://cdn.jsdelivr.net/npm/chessground@8.0.0/+esm';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0-beta.6/+esm';

const boardElement = document.getElementById('board');
const whiteTimeEl = document.getElementById('white-time');
const blackTimeEl = document.getElementById('black-time');
const whiteClockEl = document.getElementById('white-clock');
const blackClockEl = document.getElementById('black-clock');
const blackLabelEl = document.getElementById('black-label');
const aiToggleEl = document.getElementById('ai-toggle');
const modeLabelEl = document.getElementById('mode-label');
const difficultySelect = document.getElementById('difficulty-select');
const resetBtnEl = document.getElementById('reset-btn');

let chess = new Chess();
let cg = null;

// Game State
let isVsAI = false;
let whiteSeconds = 60;
let blackSeconds = 60;
let timerInterval = null;
let gameStarted = false;

// Basic Piece Values
const weights = { p: 10, n: 30, b: 35, r: 50, q: 90, k: 1000 };

// Pawn Positional Preference Table (Encourages controlling center)
const pawnPst = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [ 5,  5, 10, 27, 27, 10,  5,  5],
  [ 0,  0,  0, 25, 25,  0,  0,  0],
  [ 5, -5,-10,  0,  0,-10, -5,  5],
  [ 5, 10, 10,-20,-20, 10, 10,  5],
  [ 0,  0,  0,  0,  0,  0,  0,  0]
];

function formatTime(sec) {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateClockDisplay() {
  whiteTimeEl.textContent = formatTime(whiteSeconds);
  blackTimeEl.textContent = formatTime(blackSeconds);
}

function startClock() {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (chess.isGameOver()) {
      clearInterval(timerInterval);
      return;
    }

    const currentTurn = chess.turn();

    if (currentTurn === 'w') {
      whiteSeconds--;
      if (whiteSeconds <= 0) {
        whiteSeconds = 0;
        flagPlayer('white');
      }
    } else {
      blackSeconds--;
      if (blackSeconds <= 0) {
        blackSeconds = 0;
        flagPlayer('black');
      }
    }

    updateClockDisplay();
  }, 1000);
}

function flagPlayer(color) {
  clearInterval(timerInterval);
  if (color === 'white') {
    whiteClockEl.classList.add('flagged');
  } else {
    blackClockEl.classList.add('flagged');
  }
  cg.set({ movable: { color: null } });
}

function switchActiveClock(turn) {
  if (turn === 'w') {
    whiteClockEl.classList.add('active');
    blackClockEl.classList.remove('active');
  } else {
    blackClockEl.classList.add('active');
    whiteClockEl.classList.remove('active');
  }
}

function resetGame() {
  clearInterval(timerInterval);
  chess = new Chess();
  whiteSeconds = 60;
  blackSeconds = 60;
  gameStarted = false;

  whiteClockEl.classList.remove('flagged');
  blackClockEl.classList.remove('flagged');
  switchActiveClock('w');
  updateClockDisplay();

  cg.set({
    fen: chess.fen(),
    turnColor: 'white',
    lastMove: [],
    movable: {
      color: 'white',
      dests: getLegalMoves(chess),
    },
  });
}

// Position Evaluator
function evaluateBoard(board) {
  let totalEvaluation = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        let val = weights[piece.type] || 0;
        if (piece.type === 'p') val += pawnPst[r][c];

        if (piece.color === 'w') {
          totalEvaluation -= val; // Minimizing for Black
        } else {
          totalEvaluation += val; // Maximizing for Black
        }
      }
    }
  }

  return totalEvaluation;
}

// Minimax with Alpha-Beta Pruning
function minimax(game, depth, alpha, beta, isMaximizing) {
  if (depth === 0 || game.isGameOver()) {
    return evaluateBoard(game.board());
  }

  const moves = game.moves();

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const evalVal = minimax(game, depth - 1, alpha, beta, false);
      game.undo();
      maxEval = Math.max(maxEval, evalVal);
      alpha = Math.max(alpha, evalVal);
      if (beta <= alpha) break; // Prune
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const evalVal = minimax(game, depth - 1, alpha, beta, true);
      game.undo();
      minEval = Math.min(minEval, evalVal);
      beta = Math.min(beta, evalVal);
      if (beta <= alpha) break; // Prune
    }
    return minEval;
  }
}

// Trigger Smart AI Move
function makeAIMove() {
  if (chess.isGameOver() || chess.turn() !== 'b' || !isVsAI) return;

  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return;

  const depth = parseInt(difficultySelect.value, 10);
  let bestMove = null;
  let bestValue = -Infinity;

  // Move ordering: evaluate capturing moves first to speed up minimax
  moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

  for (const move of moves) {
    chess.move(move);
    const boardVal = minimax(chess, depth - 1, -Infinity, Infinity, false);
    chess.undo();

    if (boardVal > bestValue) {
      bestValue = boardVal;
      bestMove = move;
    }
  }

  const chosenMove = bestMove || moves[0];

  // Natural bullet response delay
  setTimeout(() => {
    if (!isVsAI || chess.turn() !== 'b') return;
    chess.move(chosenMove);

    const nextTurn = chess.turn() === 'w' ? 'white' : 'black';

    cg.set({
      fen: chess.fen(),
      turnColor: nextTurn,
      lastMove: [chosenMove.from, chosenMove.to],
      movable: {
        color: nextTurn,
        dests: getLegalMoves(chess),
      },
    });

    switchActiveClock('w');
  }, 200);
}

// Event Listeners
aiToggleEl.addEventListener('change', (e) => {
  isVsAI = e.target.checked;
  if (isVsAI) {
    modeLabelEl.textContent = 'VS Bot';
    blackLabelEl.textContent = 'BLACK (BOT)';
    difficultySelect.style.display = 'inline-block';
  } else {
    modeLabelEl.textContent = 'Mode: 2 Players';
    blackLabelEl.textContent = 'BLACK';
    difficultySelect.style.display = 'none';
  }
  resetGame();
});

resetBtnEl.addEventListener('click', resetGame);

if (boardElement) {
  cg = Chessground(boardElement, {
    movable: {
      free: false,
      color: 'white',
      dests: getLegalMoves(chess),
      events: {
        after: (orig, dest) => {
          chess.move({ from: orig, to: dest, promotion: 'q' });

          if (!gameStarted) {
            gameStarted = true;
            startClock();
          }

          const currentTurn = chess.turn();
          const turnColor = currentTurn === 'w' ? 'white' : 'black';
          switchActiveClock(currentTurn);

          if (isVsAI && currentTurn === 'b') {
            cg.set({
              turnColor: 'black',
              movable: { color: null },
            });
            makeAIMove();
          } else {
            cg.set({
              turnColor: turnColor,
              movable: {
                color: turnColor,
                dests: getLegalMoves(chess),
              },
            });
          }
        },
      },
    },
  });
}

function getLegalMoves(chessGame) {
  const dests = new Map();
  chessGame.moves({ verbose: true }).forEach((m) => {
    if (!dests.has(m.from)) dests.set(m.from, []);
    dests.get(m.from).push(m.to);
  });
  return dests;
}

updateClockDisplay();
