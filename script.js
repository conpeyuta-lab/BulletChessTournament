import { Chessground } from 'https://cdn.jsdelivr.net/npm/chessground@8.0.0/+esm';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0-beta.6/+esm';

// DOM Elements
const boardElement = document.getElementById('board');
const whiteTimeEl = document.getElementById('white-time');
const blackTimeEl = document.getElementById('black-time');
const whiteClockEl = document.getElementById('white-clock');
const blackClockEl = document.getElementById('black-clock');
const whiteLabelEl = document.getElementById('white-label');
const blackLabelEl = document.getElementById('black-label');
const whiteCapturedEl = document.getElementById('white-captured');
const blackCapturedEl = document.getElementById('black-captured');
const moveLogEl = document.getElementById('move-log');

const aiToggleEl = document.getElementById('ai-toggle');
const modeLabelEl = document.getElementById('mode-label');
const difficultySelect = document.getElementById('difficulty-select');
const resetBtnEl = document.getElementById('reset-btn');
const flipBtnEl = document.getElementById('flip-btn');

const bgMusicEl = document.getElementById('bg-music');
const musicBtnEl = document.getElementById('music-btn');

// Modal Elements
const modalOverlay = document.getElementById('game-over-modal');
const modalTitle = document.getElementById('modal-title');
const modalReason = document.getElementById('modal-reason');
const modalRestartBtn = document.getElementById('modal-restart-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');

let isMusicPlaying = false;
let boardOrientation = 'white';

// Web Audio API Synthesizer
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playAudioEffect(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;

  if (type === 'capture') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  }
}

let chess = new Chess();
let cg = null;

// Game State
let isVsAI = false;
let whiteSeconds = 60;
let blackSeconds = 60;
let timerInterval = null;
let gameStarted = false;

// Piece Evaluation & Unicode Icons
const weights = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const pieceIcons = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛',
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕'
};

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
      handleGameOver();
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
    showGameOverModal('BLACK WINS', 'White ran out of time!');
  } else {
    blackClockEl.classList.add('flagged');
    showGameOverModal('WHITE WINS', 'Black ran out of time!');
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

// Captured Pieces & Material Counter Logic
function updateCapturedDisplay() {
  const history = chess.history({ verbose: true });
  const capturedByWhite = [];
  const capturedByBlack = [];

  let whiteScore = 0;
  let blackScore = 0;

  history.forEach(m => {
    if (m.captured) {
      const p = m.captured;
      const val = weights[p] || 0;
      if (m.color === 'w') {
        capturedByWhite.push(p);
        whiteScore += val;
      } else {
        capturedByBlack.push(p);
        blackScore += val;
      }
    }
  });

  // Render White's Captures
  const wList = whiteCapturedEl.querySelector('.pieces-list');
  const wDiff = whiteCapturedEl.querySelector('.score-diff');
  wList.textContent = capturedByWhite.map(p => pieceIcons[p.toUpperCase()] || p).join('');
  wDiff.textContent = whiteScore > blackScore ? `+${whiteScore - blackScore}` : '';

  // Render Black's Captures
  const bList = blackCapturedEl.querySelector('.pieces-list');
  const bDiff = blackCapturedEl.querySelector('.score-diff');
  bList.textContent = capturedByBlack.map(p => pieceIcons[p] || p).join('');
  bDiff.textContent = blackScore > whiteScore ? `+${blackScore - whiteScore}` : '';
}

// Move History Log Render
function updateMoveLog() {
  const history = chess.history();
  moveLogEl.innerHTML = '';

  for (let i = 0; i < history.length; i += 2) {
    const moveRow = document.createElement('div');
    moveRow.className = 'move-row';

    const numSpan = document.createElement('span');
    numSpan.className = 'move-num';
    numSpan.textContent = `${Math.floor(i / 2) + 1}.`;

    const whiteSpan = document.createElement('span');
    whiteSpan.className = 'white-move';
    whiteSpan.textContent = history[i] || '';

    const blackSpan = document.createElement('span');
    blackSpan.className = 'black-move';
    blackSpan.textContent = history[i + 1] || '';

    moveRow.appendChild(numSpan);
    moveRow.appendChild(whiteSpan);
    moveRow.appendChild(blackSpan);
    moveLogEl.appendChild(moveRow);
  }

  moveLogEl.scrollTop = moveLogEl.scrollHeight;
}

// Game Over Modal Handling (Fixed syntax for chess.js v1.0.0-beta.6)
function handleGameOver() {
  clearInterval(timerInterval);
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'BLACK' : 'WHITE';
    showGameOverModal(`${winner} WINS`, 'By Checkmate');
  } else if (chess.isDraw()) {
    showGameOverModal('DRAW', 'By Stalemate / Insufficient Material');
  }
}

function showGameOverModal(title, reason) {
  modalTitle.textContent = title;
  modalReason.textContent = reason;
  modalOverlay.classList.remove('hidden');
}

function hideGameOverModal() {
  modalOverlay.classList.add('hidden');
}

function resetGame() {
  clearInterval(timerInterval);
  chess = new Chess();
  whiteSeconds = 60;
  blackSeconds = 60;
  gameStarted = false;

  hideGameOverModal();
  whiteClockEl.classList.remove('flagged');
  blackClockEl.classList.remove('flagged');
  switchActiveClock('w');
  updateClockDisplay();
  updateCapturedDisplay();
  updateMoveLog();

  const userColor = boardOrientation === 'white' ? 'white' : 'black';

  cg.set({
    fen: chess.fen(),
    orientation: boardOrientation,
    turnColor: 'white',
    lastMove: [],
    movable: {
      color: userColor,
      dests: getLegalMoves(chess),
    },
  });

  if (isVsAI && boardOrientation === 'black') {
    setTimeout(makeAIMove, 400);
  }
}

// Minimax Bot AI
function evaluateBoard(board) {
  let totalEvaluation = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        let val = (weights[piece.type] * 10) || 0;
        if (piece.type === 'p') val += pawnPst[r][c];
        if (piece.color === 'w') {
          totalEvaluation -= val;
        } else {
          totalEvaluation += val;
        }
      }
    }
  }
  return totalEvaluation;
}

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
      if (beta <= alpha) break;
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
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function makeAIMove() {
  if (chess.isGameOver()) return;

  const currentTurn = chess.turn();
  const botColor = boardOrientation === 'white' ? 'b' : 'w';
  if (currentTurn !== botColor || !isVsAI) return;

  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return;

  const depth = parseInt(difficultySelect.value, 10);
  let bestMove = null;
  let bestValue = botColor === 'b' ? -Infinity : Infinity;

  moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

  for (const move of moves) {
    chess.move(move);
    const boardVal = minimax(chess, depth - 1, -Infinity, Infinity, botColor === 'w');
    chess.undo();

    if (botColor === 'b' && boardVal > bestValue) {
      bestValue = boardVal;
      bestMove = move;
    } else if (botColor === 'w' && boardVal < bestValue) {
      bestValue = boardVal;
      bestMove = move;
    }
  }

  const chosenMove = bestMove || moves[0];

  setTimeout(() => {
    if (!isVsAI || chess.turn() !== botColor) return;

    const playedMove = chess.move(chosenMove);
    playAudioEffect(playedMove.captured ? 'capture' : 'move');

    if (!gameStarted) {
      gameStarted = true;
      startClock();
    }

    const nextTurn = chess.turn() === 'w' ? 'white' : 'black';
    const userColor = boardOrientation;

    updateCapturedDisplay();
    updateMoveLog();

    cg.set({
      fen: chess.fen(),
      turnColor: nextTurn,
      lastMove: [chosenMove.from, chosenMove.to],
      movable: {
        color: userColor,
        dests: getLegalMoves(chess),
      },
    });

    switchActiveClock(chess.turn());
    if (chess.isGameOver()) handleGameOver();
  }, 250);
}

// Event Listeners
flipBtnEl.addEventListener('click', () => {
  boardOrientation = boardOrientation === 'white' ? 'black' : 'white';
  resetGame();
});

musicBtnEl.addEventListener('click', () => {
  if (isMusicPlaying) {
    bgMusicEl.pause();
    musicBtnEl.textContent = '🎵 Music: OFF';
    isMusicPlaying = false;
  } else {
    bgMusicEl.play().then(() => {
      musicBtnEl.textContent = '🎶 Music: ON';
      isMusicPlaying = true;
    }).catch(err => console.log('Autoplay blocked:', err));
  }
});

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
modalRestartBtn.addEventListener('click', resetGame);
modalCloseBtn.addEventListener('click', hideGameOverModal);

if (boardElement) {
  cg = Chessground(boardElement, {
    orientation: 'white',
    movable: {
      free: false,
      color: 'white',
      dests: getLegalMoves(chess),
      events: {
        after: (orig, dest) => {
          const playedMove = chess.move({ from: orig, to: dest, promotion: 'q' });
          playAudioEffect(playedMove.captured ? 'capture' : 'move');

          if (!gameStarted) {
            gameStarted = true;
            startClock();
          }

          updateCapturedDisplay();
          updateMoveLog();

          const currentTurn = chess.turn();
          const turnColor = currentTurn === 'w' ? 'white' : 'black';
          switchActiveClock(currentTurn);

          if (chess.isGameOver()) {
            handleGameOver();
            return;
          }

          const botColor = boardOrientation === 'white' ? 'b' : 'w';
          if (isVsAI && currentTurn === botColor) {
            cg.set({
              turnColor: turnColor,
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
