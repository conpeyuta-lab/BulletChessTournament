import { Chessground } from 'https://cdn.jsdelivr.net/npm/chessground@8.0.0/+esm';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0-beta.6/+esm';

// EMBEDDED CONSOLE SIGNATURE
console.log(
  `%c ⚔️ GOTHIC BULLET CHESS ⚔️ \n%c Built & Designed by Mohamed Boudili \n Official YouTube: https://www.youtube.com/@Conpeyuta \n Copyright © 2026. All rights reserved.`,
  'color: #ff1a1a; font-size: 16px; font-weight: bold; background: #111; padding: 6px;',
  'color: #d4af37; font-size: 12px; background: #000; padding: 4px;'
);

// DOM Elements
const boardElement = document.getElementById('board');
const coinCountEl = document.getElementById('coin-count');
const musicBtn = document.getElementById('music-btn');
const jazzAudio = document.getElementById('jazz-music');
const moveLogEl = document.getElementById('move-log');
const resetBtn = document.getElementById('reset-btn');
const flipBtn = document.getElementById('flip-btn');

// Creator Modal Elements
const aboutCreatorBtn = document.getElementById('about-creator-btn');
const creatorModal = document.getElementById('creator-modal');
const closeCreatorBtn = document.getElementById('close-creator-btn');
const subAndClaimBtn = document.getElementById('sub-and-claim-btn');

// Arena & Mode Elements
const arenaPlayBtn = document.getElementById('arena-play-btn');
const menuModal = document.getElementById('menu-modal');
const closeMenuBtn = document.getElementById('close-menu-btn');
const modeLocalBtn = document.getElementById('mode-local-btn');
const modeBotBtn = document.getElementById('mode-bot-btn');
const botSettings = document.getElementById('bot-settings');
const difficultySelect = document.getElementById('difficulty-select');

// Tournament Elements
const tournamentBtn = document.getElementById('tournament-btn');
const bracketView = document.getElementById('bracket-view');
const startTourneyMatchBtn = document.getElementById('start-tourney-match-btn');
const m1Slot = document.getElementById('m1');

// Game State Variables
let currentMode = 'local';
let tourneyRound = 1;
let userCoins = parseInt(localStorage.getItem('blood_gold_coins') || '0', 10);
let subRewardClaimed = localStorage.getItem('sub_reward_claimed') === 'true';
let isMusicPlaying = false;

coinCountEl.textContent = userCoins;

if (subRewardClaimed) {
  subAndClaimBtn.textContent = '✓ Subscribed (+10 Coins Claimed)';
  subAndClaimBtn.disabled = true;
  subAndClaimBtn.style.opacity = '0.6';
}

let chess = new Chess();
let cg = null;

// CORS-SAFE STOCKFISH WORKER INITIALIZATION (JSFiddle/Web Compatible)
let stockfish = null;

async function initStockfishEngine() {
  try {
    const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');
    const scriptText = await response.text();
    const blob = new Blob([scriptText], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    stockfish = new Worker(workerUrl);
    stockfish.postMessage('uci');
    stockfish.postMessage('isready');

    stockfish.onmessage = function (event) {
      const line = event.data;
      if (line.startsWith('bestmove')) {
        const parts = line.split(' ');
        const bestMove = parts[1];
        if (bestMove && bestMove !== '(none)') {
          executeStockfishMove(bestMove);
        }
      }
    };
    console.log('✅ Stockfish Engine successfully loaded!');
  } catch (err) {
    console.error('Failed to initialize Stockfish worker:', err);
  }
}

initStockfishEngine();

// Jazz Music Control Trigger
musicBtn.addEventListener('click', () => {
  if (!isMusicPlaying) {
    jazzAudio.play().then(() => {
      isMusicPlaying = true;
      musicBtn.textContent = '🎷 Jazz: ON';
      musicBtn.style.borderColor = 'var(--gold)';
    }).catch(err => console.log("Audio play error:", err));
  } else {
    jazzAudio.pause();
    isMusicPlaying = false;
    musicBtn.textContent = '🎷 Jazz: OFF';
    musicBtn.style.borderColor = 'var(--border-color)';
  }
});

// Creator Pop-up Events
aboutCreatorBtn.addEventListener('click', () => creatorModal.classList.remove('hidden'));
closeCreatorBtn.addEventListener('click', () => creatorModal.classList.add('hidden'));

// YouTube Redirect + Reward Claim
subAndClaimBtn.addEventListener('click', () => {
  window.open('https://www.youtube.com/@Conpeyuta', '_blank');

  if (!subRewardClaimed) {
    userCoins += 10;
    subRewardClaimed = true;
    localStorage.setItem('blood_gold_coins', userCoins.toString());
    localStorage.setItem('sub_reward_claimed', 'true');
    coinCountEl.textContent = userCoins;
    
    subAndClaimBtn.textContent = '✓ Subscribed (+10 Coins Claimed)';
    subAndClaimBtn.disabled = true;
    subAndClaimBtn.style.opacity = '0.6';
  }
});

// Arena Menu Controls
arenaPlayBtn.addEventListener('click', () => menuModal.classList.remove('hidden'));
closeMenuBtn.addEventListener('click', () => menuModal.classList.add('hidden'));

// Mode Selectors
modeLocalBtn.addEventListener('click', () => {
  currentMode = 'local';
  modeLocalBtn.classList.add('active-mode');
  modeBotBtn.classList.remove('active-mode');
  botSettings.classList.add('hidden');
  bracketView.classList.add('hidden');
  menuModal.classList.add('hidden');
  resetGame();
});

modeBotBtn.addEventListener('click', () => {
  currentMode = 'bot';
  modeBotBtn.classList.add('active-mode');
  modeLocalBtn.classList.remove('active-mode');
  botSettings.classList.remove('hidden');
  bracketView.classList.add('hidden');
  menuModal.classList.add('hidden');
  resetGame();
});

tournamentBtn.addEventListener('click', () => {
  bracketView.classList.toggle('hidden');
});

startTourneyMatchBtn.addEventListener('click', () => {
  currentMode = 'tournament';
  menuModal.classList.add('hidden');
  resetGame();
});

resetBtn.addEventListener('click', () => resetGame());
flipBtn.addEventListener('click', () => cg.toggleOrientation());

// Initialize Chessground
function initBoard() {
  cg = Chessground(boardElement, {
    orientation: 'white',
    movable: {
      free: false,
      color: 'white',
      dests: getLegalMoves(chess),
      events: {
        after: (orig, dest) => handleUserMove(orig, dest)
      }
    },
  });
}

function handleUserMove(orig, dest) {
  const move = chess.move({ from: orig, to: dest, promotion: 'q' });
  if (!move) return;

  updateBoardState();

  if ((currentMode === 'bot' || currentMode === 'tournament') && !chess.isGameOver()) {
    triggerStockfish();
  }
}

// STOCKFISH ENGINE TRIGGER
function triggerStockfish() {
  if (!stockfish) return;

  let skillLevel = 20;
  let depth = 12;

  if (currentMode === 'tournament') {
    if (tourneyRound === 1) { skillLevel = 5; depth = 5; }
    else if (tourneyRound === 2) { skillLevel = 12; depth = 8; }
    else { skillLevel = 20; depth = 14; }
  } else {
    const lvl = parseInt(difficultySelect.value, 10);
    if (lvl === 1) { skillLevel = 1; depth = 3; }
    else if (lvl === 2) { skillLevel = 8; depth = 6; }
    else { skillLevel = 20; depth = 12; }
  }

  stockfish.postMessage(`setoption name Skill Level value ${skillLevel}`);
  stockfish.postMessage(`position fen ${chess.fen()}`);
  stockfish.postMessage(`go depth ${depth}`);
}

function executeStockfishMove(moveString) {
  const from = moveString.substring(0, 2);
  const to = moveString.substring(2, 4);
  const promotion = moveString.length > 4 ? moveString.charAt(4) : 'q';

  chess.move({ from, to, promotion });
  updateBoardState();

  if (chess.isGameOver()) {
    if (chess.isCheckmate() && chess.turn() === 'w') {
      if (currentMode === 'tournament') {
        if (tourneyRound < 3) {
          tourneyRound++;
          alert(`🏆 Round ${tourneyRound - 1} Victory! Heading to Round ${tourneyRound}!`);
          m1Slot.textContent = `Round ${tourneyRound}: YOU vs Boss #${tourneyRound}`;
        } else {
          userCoins += 7;
          localStorage.setItem('blood_gold_coins', userCoins.toString());
          coinCountEl.textContent = userCoins;
          alert('🔥 TOURNAMENT CHAMPION! You won 7 Blood Coins!');
          tourneyRound = 1;
          m1Slot.textContent = `Round 1: YOU vs Boss #1`;
        }
      }
    }
  }
}

function updateBoardState() {
  cg.set({
    fen: chess.fen(),
    turnColor: chess.turn() === 'w' ? 'white' : 'black',
    movable: {
      color: (currentMode === 'local') 
        ? (chess.turn() === 'w' ? 'white' : 'black') 
        : 'white',
      dests: getLegalMoves(chess)
    }
  });

  const history = chess.history();
  if (history.length > 0) {
    const lastMove = history[history.length - 1];
    const logItem = document.createElement('div');
    logItem.textContent = `${history.length}. ${lastMove}`;
    moveLogEl.appendChild(logItem);
    moveLogEl.scrollTop = moveLogEl.scrollHeight;
  }
}

function resetGame() {
  chess.reset();
  moveLogEl.innerHTML = '';
  updateBoardState();
}

function getLegalMoves(chessGame) {
  const dests = new Map();
  chessGame.moves({ verbose: true }).forEach((m) => {
    if (!dests.has(m.from)) dests.set(m.from, []);
    dests.get(m.from).push(m.to);
  });
  return dests;
}

// Start Game
initBoard();
