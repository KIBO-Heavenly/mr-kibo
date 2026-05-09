// ════════════════════════════════════════════════════════════
// MAIN.JS — Firebase init, constants, audio, routing,
//           Firebase listeners, Hot Potato, Finale,
//           Master Control Panel + context for all round modules
// ════════════════════════════════════════════════════════════

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js';
import { getDatabase, ref, set, get, update, onValue }
  from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js';

import { init as initTrivia,     renderHostTrivia,     renderPlayerTrivia     } from './rounds/trivia.js';
import { init as initRedButton,  renderHostRedButton,  renderPlayerRedButton, soundRbPop  } from './rounds/redbutton.js';
import { init as initTypewave,   renderHostTypewave,   renderPlayerTypewave   } from './rounds/typewave.js';
import { init as initStacker,    renderHostStacker,    renderPlayerStacker, resolveStacker, stLocal } from './rounds/stacker.js';
import { init as initTapBattle,  renderHostTapBattle,  renderPlayerTapBattle  } from './rounds/tapbattle.js';
import { init as initBetrayal,   renderHostBetrayal,   renderPlayerBetrayal   } from './rounds/betrayal.js';
import { init as initWheel,      renderHostWheel,      renderPlayerWheel      } from './rounds/wheel.js';
import { init as initHotPotato, renderHostHotPotato, renderPlayerHotPotato  } from './rounds/hotpotato.js';

// ── Firebase Config ────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyDxjNppk6pwMtpi8yoVoMYgiQR0nBHYzoQ',
  authDomain:        'mrbeast-game.firebaseapp.com',
  databaseURL:       'https://mrbeast-game-default-rtdb.firebaseio.com',
  projectId:         'mrbeast-game',
  storageBucket:     'mrbeast-game.firebasestorage.app',
  messagingSenderId: '1039453700723',
  appId:             '1:1039453700723:web:bf118edbcd8429c510e006',
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ── Player Keys (8 players) ────────────────────────────────
const PLAYER_KEYS = ['player1','player2','player3','player4','player5','player6','player7','player8'];

// ── Point Events ───────────────────────────────────────────
const POINT_EVENTS = {
  TRIVIA_CORRECT:           +5,
  TRIVIA_STEAL:            +20,
  TRIVIA_STOLEN:           -20,
  REDBUTTON_WIN:           +20,
  REDBUTTON_LOSE:          -10,
  TYPEWAVE_WRONG:           -5,
  TYPEWAVE_WIN:            +25,
  TYPEWAVE_LOSE:           -15,
  STACKER_WIN:             +25,
  STACKER_LOSE:            -15,
  STACKER_TIE:              +5,
  TAPBATTLE_WIN:           +25,
  TAPBATTLE_LOSE:          -15,
  BETRAYAL_BOTH_COOPERATE: +15,
  BETRAYAL_BETRAY_WIN:     +30,
  BETRAYAL_BETRAY_LOSS:    -20,
  BETRAYAL_BOTH_BETRAY:    -10,
  REACTION_WIN:            +20,
  REACTION_LOSE:           -10,
  HOTPOTATO_WIN:           +20,
  HOTPOTATO_LOSE:          -20,
};
const MONEY_EVENTS = POINT_EVENTS; // backwards compat alias

// ── Round metadata ─────────────────────────────────────────
const ALL_ROUND_IDS = ['trivia', 'redbutton', 'typewave', 'stacker', 'tapbattle', 'betrayal', 'wheel', 'hotpotato'];
const ROUND_NAMES = {
  trivia:     'Round 1',
  redbutton:  'Round 2',
  typewave:   'Round 3',
  stacker:    'Round 4',
  tapbattle:  'Round 5',
  betrayal:   'Round 6',
  wheel:      'Round 7',
  hotpotato:  'Round 8',
};

// ── Money Counter Animation ────────────────────────────────
let animateMoneyChange = function(elementId, from, to) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const diff     = to - from;
  const duration = 1500;
  const steps    = 60;
  let   step     = 0;
  el.style.color = diff > 0 ? 'var(--green)' : 'var(--red)';

  el.classList.remove('pop-up', 'pop-down');
  void el.offsetWidth;
  el.classList.add(diff > 0 ? 'pop-up' : 'pop-down');

  const interval = setInterval(() => {
    step++;
    const current = Math.round(from + (diff * (step / steps)));
    el.textContent = `${current} pts`;
    if (step >= steps) {
      clearInterval(interval);
      el.style.color = 'var(--white)';
      el.classList.remove('pop-up', 'pop-down');
    }
  }, duration / steps);
};

// ── Full-screen flash ──────────────────────────────────────
function flashTransition(color = 'var(--white)', durationMs = 500) {
  const overlay = document.getElementById('flash-overlay');
  overlay.style.background  = color;
  overlay.style.transition  = 'none';
  overlay.style.opacity     = '1';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.transition = `opacity ${durationMs}ms ease-out`;
      overlay.style.opacity    = '0';
    });
  });
}

// ════════════════════════════════════════════════════════════
// AUDIO ENGINE — Web Audio API procedural sounds
// ════════════════════════════════════════════════════════════
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function playTone({ freq = 440, type = 'sine', gain = 0.4, duration = 0.12, attack = 0.005, decay = 0.08, delay = 0 } = {}) {
  try {
    const ctx = getAudioCtx();
    const t   = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.connect(env);
    env.connect(ctx.destination);
    osc.type      = type;
    osc.frequency.setValueAtTime(freq, t);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
    osc.start(t);
    osc.stop(t + duration);
  } catch (_) {}
}

function soundClick() {
  playTone({ freq: 1200, type: 'square', gain: 0.18, duration: 0.06, attack: 0.001, decay: 0.04 });
}

function soundBeep(n) {
  const freqs = { 3: 440, 2: 550, 1: 660 };
  const f = freqs[n] || 440;
  playTone({ freq: f, type: 'sine', gain: 0.5, duration: 0.22, attack: 0.01, decay: 0.18 });
}

function soundGo() {
  playTone({ freq: 880,  type: 'sine', gain: 0.55, duration: 0.18, attack: 0.005, decay: 0.15 });
  playTone({ freq: 1100, type: 'sine', gain: 0.45, duration: 0.2,  attack: 0.005, decay: 0.17, delay: 0.1 });
}

function soundFanfare() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    playTone({ freq: f, type: 'triangle', gain: 0.5, duration: 0.35, attack: 0.01, decay: 0.3, delay: i * 0.1 });
  });
  setTimeout(() => {
    [523, 659, 784].forEach(f => {
      playTone({ freq: f, type: 'sine', gain: 0.2, duration: 0.6, attack: 0.02, decay: 0.55, delay: 0 });
    });
  }, 380);
}

function soundElimination() {
  const notes = [330, 277, 220, 185];
  notes.forEach((f, i) => {
    playTone({ freq: f, type: 'sawtooth', gain: 0.3, duration: 0.28, attack: 0.01, decay: 0.24, delay: i * 0.12 });
  });
}

function soundMoneyUp() {
  playTone({ freq: 784,  type: 'sine', gain: 0.3,  duration: 0.12, attack: 0.005, decay: 0.1  });
  playTone({ freq: 1047, type: 'sine', gain: 0.25, duration: 0.15, attack: 0.005, decay: 0.12, delay: 0.08 });
}

function soundMoneyDown() {
  playTone({ freq: 220, type: 'triangle', gain: 0.35, duration: 0.2,  attack: 0.005, decay: 0.17 });
  playTone({ freq: 165, type: 'triangle', gain: 0.25, duration: 0.25, attack: 0.005, decay: 0.22, delay: 0.08 });
}

function soundRoundIntro() {
  try {
    const ctx = getAudioCtx();
    const t   = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.connect(env);
    env.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.5);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.25, t + 0.05);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.start(t);
    osc.stop(t + 0.55);
  } catch (_) {}
}

// Patch animateMoneyChange to play sounds
const _origAnimateMoney = animateMoneyChange;
animateMoneyChange = function(elementId, from, to) {
  _origAnimateMoney(elementId, from, to);
  if (to === 0 && from > 0) {
    soundElimination();
    flashTransition('#FF2D2D', 800);
  } else if (to > from) {
    soundMoneyUp();
  } else if (to < from) {
    soundMoneyDown();
  }
};

// ════════════════════════════════════════════════════════════
// ROUND WIPE TRANSITION
// ════════════════════════════════════════════════════════════
function roundWipeTransition(labelText) {
  return new Promise(resolve => {
    const wipe  = document.getElementById('round-wipe');
    const panel = wipe.querySelector('.wipe-panel');
    const label = document.getElementById('wipe-label');
    label.textContent = labelText;

    panel.style.transition = 'none';
    panel.style.transform  = 'translateX(-100%)';
    label.style.opacity    = '0';
    label.style.transform  = 'scale(0.7)';
    wipe.style.pointerEvents = 'all';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panel.style.transition = 'transform 0.38s cubic-bezier(0.55,0,0.1,1)';
        panel.style.transform  = 'translateX(0%)';
        soundRoundIntro();
      });
    });

    setTimeout(() => {
      label.style.transition = 'opacity 0.18s, transform 0.22s cubic-bezier(0.34,1.56,0.64,1)';
      label.style.opacity    = '1';
      label.style.transform  = 'scale(1)';
    }, 300);

    setTimeout(() => {
      resolve();
    }, 600);

    setTimeout(() => {
      label.style.transition = 'opacity 0.15s';
      label.style.opacity    = '0';
      panel.style.transition = 'transform 0.38s cubic-bezier(0.55,0,0.1,1)';
      panel.style.transform  = 'translateX(100%)';
      wipe.style.pointerEvents = 'none';
    }, 1300);
  });
}

// ════════════════════════════════════════════════════════════
// 3-2-1 COUNTDOWN
// ════════════════════════════════════════════════════════════
function showCountdown(labelText = 'GET READY') {
  return new Promise(resolve => {
    const overlay = document.getElementById('countdown-overlay');
    const numEl   = document.getElementById('countdown-number');
    const lblEl   = document.getElementById('countdown-label');
    if (!overlay || !numEl || !lblEl) { resolve(); return; }

    lblEl.textContent = labelText;
    overlay.classList.add('visible');

    const steps = ['3', '2', '1', 'GO!'];
    let   i     = 0;

    function tick() {
      const val = steps[i];
      numEl.textContent = val;
      numEl.classList.remove('pop');
      void numEl.offsetWidth;
      numEl.classList.add('pop');

      if (val === 'GO!') {
        soundGo();
        setTimeout(() => {
          overlay.classList.remove('visible');
          numEl.classList.remove('pop');
          resolve();
        }, 700);
      } else {
        soundBeep(Number(val));
        i++;
        setTimeout(tick, 900);
      }
    }

    setTimeout(tick, 80);
  });
}

// ════════════════════════════════════════════════════════════
// CONFETTI SYSTEM
// ════════════════════════════════════════════════════════════
(function setupConfetti() {
  const canvas  = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx     = canvas.getContext('2d');
  let particles = [];
  let rafId     = null;
  let running   = false;

  const COLORS  = ['#FFD700','#00FF87','#FF2D2D','#0088FF','#FF8C00','#C850FF','#FFFFFF'];
  const COUNT   = 180;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function makeParticle() {
    return {
      x:   Math.random() * canvas.width,
      y:   -10 - Math.random() * canvas.height * 0.3,
      vx:  (Math.random() - 0.5) * 4,
      vy:  3 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.25,
      w:   8 + Math.random() * 12,
      h:   4 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 1,
    };
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x   += p.vx;
      p.y   += p.vy;
      p.vy  += 0.08;
      p.vx  *= 0.995;
      p.rot += p.vrot;
      if (p.y > canvas.height - 40) p.alpha -= 0.015;
      if (p.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    });
    if (alive) {
      rafId = requestAnimationFrame(loop);
    } else {
      canvas.classList.remove('visible');
      running = false;
    }
  }

  window.launchConfetti = function() {
    if (running) return;
    running = true;
    resize();
    particles = Array.from({ length: COUNT }, makeParticle);
    canvas.classList.add('visible');
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
    soundFanfare();
  };
})();

// ── URL Routing ───────────────────────────────────────────
const params    = new URLSearchParams(window.location.search);
const view      = params.get('view');    // 'host' | 'player'
const playerKey = view === 'host' ? null : params.get('player');

const elHostView   = document.getElementById('host-view');
const elPlayerView = document.getElementById('player-view');
const elNoRoute    = document.getElementById('no-route');
const elMoneyBar   = document.getElementById('money-bar');

const lobbyShareEl = document.getElementById('lobby-share-url');
if (lobbyShareEl) lobbyShareEl.textContent = window.location.origin + window.location.pathname;

function showView(which) {
  elNoRoute.classList.add('hidden');
  elMoneyBar.classList.remove('hidden');
  if (which === 'host') {
    elHostView.classList.remove('hidden');
  } else {
    elPlayerView.classList.remove('hidden');
  }
}

const VALID_PLAYER_KEYS = PLAYER_KEYS;
if (view === 'host') {
  showView('host');
} else if (view === 'player' && VALID_PLAYER_KEYS.includes(playerKey)) {
  showView('player');
  const slotNum   = parseInt(playerKey.replace('player', ''), 10);
  const slotLabel = document.getElementById('player-slot-label');
  if (slotLabel) slotLabel.textContent = `You are Player ${slotNum}`;

  // Slot-taken guard
  const SESSION_KEY   = 'ownedSlot_' + playerKey;
  const alreadyOwnsSlot = sessionStorage.getItem(SESSION_KEY) === '1';
  if (!alreadyOwnsSlot) {
    get(ref(db, `players/${playerKey}/name`)).then(snap => {
      const existingName = snap.val();
      if (existingName && existingName.trim().length > 0) {
        document.getElementById('player-view').classList.add('hidden');
        document.getElementById('slot-taken-overlay').classList.remove('hidden');
        document.getElementById('money-bar').classList.add('hidden');
      }
    }).catch(() => {});
  }

  window._onSlotClaimed = () => sessionStorage.setItem(SESSION_KEY, '1');
} else if (!view) {
  // No-route screen: mark taken slots live
  onValue(ref(db, 'players'), (snapshot) => {
    const data = snapshot.val();
    PLAYER_KEYS.forEach((key, i) => {
      const pd      = data?.[key];
      const isTaken = pd && pd.name && pd.name.trim().length > 0;
      const linkEl  = document.getElementById(`route-${key}`);
      if (!linkEl) return;
      if (isTaken) {
        linkEl.classList.add('slot-taken');
        linkEl.innerHTML = `<span>Player ${i + 1} — ${pd.name}</span><span class="taken-badge">Taken</span>`;
      } else {
        linkEl.classList.remove('slot-taken');
        linkEl.textContent = `Player ${i + 1}`;
      }
    });
  });
}

// ── Phase-based panel switching ────────────────────────────
function syncPhase(gameData) {
  if (!gameData) return;
  const phase   = gameData.phase        ?? 'lobby';
  const roundN  = gameData.currentRound ?? 0;
  const roundId = ALL_ROUND_IDS[roundN - 1];

  if (view === 'host') {
    const isLobby = phase === 'lobby';
    document.getElementById('host-lobby').classList.toggle('hidden', !isLobby);

    ALL_ROUND_IDS.forEach(id => {
      const el = document.getElementById(`host-${id}`);
      if (el) el.classList.toggle('hidden', phase !== 'round' || id !== roundId);
    });

    document.getElementById('host-results').classList.toggle('hidden', phase !== 'finale');
  }

  if (view === 'player') {
    const isLobby = phase === 'lobby';
    document.getElementById('player-waiting').classList.toggle('hidden', !isLobby);
    document.getElementById('player-game').classList.toggle('hidden',
      phase !== 'round' && phase !== 'result');

    ALL_ROUND_IDS.forEach(id => {
      const el = document.getElementById(`player-${id}`);
      if (el) el.classList.toggle('hidden', phase !== 'round' || id !== roundId);
    });

    document.getElementById('player-results').classList.toggle('hidden', phase !== 'finale');

    if (isLobby) {
      const statusEl = document.getElementById('waiting-status');
      if (statusEl) statusEl.textContent = 'WAITING FOR HOST…';
    }
  }
}

// ── Init: seed default game state (host only, once) ───────
async function initGameState() {
  try {
    const gameSnap = await get(ref(db, 'game'));
    if (!gameSnap.exists()) {
      await set(ref(db, 'game'), {
        phase:        'lobby',
        currentRound: 0,
        roundActive:  false,
      });
    }
    const playersSnap = await get(ref(db, 'players'));
    if (!playersSnap.exists()) {
      const playersInit = {};
      PLAYER_KEYS.forEach(k => {
        playersInit[k] = { name: '', points: 0, startingPoints: 0, alive: true, answer: null, ready: false };
      });
      await set(ref(db, 'players'), playersInit);
    }
  } catch (err) {
    console.error('[Birthday Game] initGameState error:', err);
  }
}

if (view === 'host') initGameState();

// ── Global button click sound ─────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('button, .btn-vote');
  if (btn && !btn.disabled) soundClick();
}, { capture: true });

// ── Host: START GAME button ───────────────────────────────
const btnStart = document.getElementById('btn-start-game');
if (btnStart) {
  btnStart.addEventListener('click', async () => {
    btnStart.disabled = true;
    try {
      await roundWipeTransition('ROUND 1');
      await update(ref(db, 'game'), {
        phase:        'round',
        currentRound: 1,
        roundActive:  false,
      });
    } catch (err) {
      console.error('[Birthday Game] Start game error:', err);
      btnStart.disabled = false;
    }
  });
}

// ── Host lobby: live player card updates ──────────────────
function updateHostCards(playersData) {
  if (!playersData) return;
  const container = document.getElementById('host-lobby-players');
  if (!container) return;
  container.innerHTML = '';
  let joinedCount = 0;
  PLAYER_KEYS.forEach((key, i) => {
    const player  = playersData[key] ?? {};
    const hasName = player.name && player.name.trim().length > 0;
    if (hasName) joinedCount++;
    const label   = `Player ${i + 1}`;
    const card    = document.createElement('div');
    card.className = 'lobby-player-card' + (hasName ? ' ready' : '');
    card.innerHTML = `
      <div class="card-eyebrow">${label}</div>
      <div class="card-name">${hasName ? player.name : '—'}</div>
      <div class="card-status">${hasName ? '✓ Ready' : 'Waiting to join…'}</div>
    `;
    container.appendChild(card);
  });
  if (btnStart) btnStart.disabled = joinedCount < 2;
}

// ── Player: name input, lock-in ────────────────────────────
if (view === 'player' && playerKey) {
  const nameInput = document.getElementById('name-input');
  const btnLock   = document.getElementById('btn-lock-name');

  async function lockName() {
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) return;
    try {
      await update(ref(db, `players/${playerKey}`), { name, points: 0, startingPoints: 0, alive: true, ready: true });
      if (nameInput) nameInput.disabled = true;
      if (btnLock)   { btnLock.textContent = '✓ LOCKED'; btnLock.disabled = true; }
      if (window._onSlotClaimed) window._onSlotClaimed();
    } catch (err) {
      console.error('[Birthday Game] Name lock error:', err);
    }
  }

  if (btnLock)   btnLock.addEventListener('click', lockName);
  if (nameInput) nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') lockName(); });

  try {
    onValue(ref(db, `players/${playerKey}/name`), snap => {
      const savedName = snap.val();
      if (savedName && nameInput && !nameInput.disabled) {
        nameInput.value = savedName;
      }
    });
  } catch (err) {
    console.error('[Birthday Game] Name sync error:', err);
  }
}

// ── Live Points Bar ────────────────────────────────────────
const cachedPts = {};
PLAYER_KEYS.forEach(k => { cachedPts[k] = 0; });

function buildPtsBar(playersData) {
  const container = document.getElementById('pts-bar-players');
  if (!container) return;
  PLAYER_KEYS.forEach(k => {
    const pd = playersData?.[k];
    if (!pd || !pd.name) return;
    const pts = pd.points ?? 0;
    let el = document.getElementById(`pbar-${k}`);
    if (!el) {
      el = document.createElement('div');
      el.id        = `pbar-${k}`;
      el.className = 'money-player';
      el.innerHTML = `<span class="player-label" id="pbar-lbl-${k}"></span><span class="money-amount" id="pbar-amt-${k}">0 pts</span>`;
      container.appendChild(el);
    }
    const lblEl = document.getElementById(`pbar-lbl-${k}`);
    const amtEl = document.getElementById(`pbar-amt-${k}`);
    if (lblEl) lblEl.textContent = pd.name;
    if (amtEl && pts !== cachedPts[k]) {
      animateMoneyChange(`pbar-amt-${k}`, cachedPts[k], pts);
      cachedPts[k] = pts;
    }
  });
}

// ── Module-level mutable state ────────────────────────────
let latestRoundData   = null;
let latestPlayersData = null;
let latestGamePhase   = null;

// ── Firebase listeners ────────────────────────────────────
try {
  onValue(ref(db, 'players'), (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    buildPtsBar(data);

    if (view === 'host') {
      updateHostCards(data);
      latestPlayersData = data;
      if (latestRoundData?.id === 'trivia')     renderHostTrivia(latestRoundData, data);
      if (latestRoundData?.id === 'redbutton')  renderHostRedButton(latestRoundData, data);
      if (latestRoundData?.id === 'typewave')   renderHostTypewave(latestRoundData, data);
      if (latestRoundData?.id === 'stacker')    renderHostStacker(latestRoundData, data);
      if (latestRoundData?.id === 'tapbattle')  renderHostTapBattle(latestRoundData, data);
      if (latestRoundData?.id === 'betrayal')   renderHostBetrayal(latestRoundData, data);
      if (latestRoundData?.id === 'wheel')      renderHostWheel(latestRoundData, data);
      if (latestRoundData?.id === 'hotpotato')  renderHostHotPotato(latestRoundData, data);
      if (latestGamePhase === 'finale')         renderFinale(data, latestRoundData);
    }

    if (view === 'player') {
      latestPlayersData = data;
      if (latestGamePhase === 'finale') renderFinale(data, latestRoundData);
    }
  });

  onValue(ref(db, 'game'), (snapshot) => {
    const data  = snapshot.val();
    const badge = document.getElementById('round-badge');
    if (badge) {
      if (!data || data.phase === 'lobby') {
        badge.textContent = 'LOBBY';
      } else {
        const roundId = ALL_ROUND_IDS[(data.currentRound ?? 1) - 1];
        badge.textContent = roundId ? ROUND_NAMES[roundId] : 'LOBBY';
      }
    }
    latestGamePhase = data?.phase ?? null;
    if (data?.phase === 'finale') {
      renderFinale(latestPlayersData, latestRoundData);
    }
    syncPhase(data);
  });
} catch (err) {
  console.error('[Birthday Game] Firebase listener error:', err);
}

// ── Red Button: track prev state for pop sound ────────────
let _rbPrevBtnVisible = false;

// ── /round listener: dispatch to round modules ────────────
let _prevRoundId    = null;
let _prevRoundState = null;
let _cdShown        = false;

try {
  onValue(ref(db, 'round'), (snapshot) => {
    const data = snapshot.val();
    latestRoundData = data;

    if (!data) return;

    // Player: show 3-2-1 countdown when round transitions to active
    if (view === 'player') {
      const newRound   = data.id !== _prevRoundId;
      const wentActive = data.state === 'active' && _prevRoundState !== 'active';
      if ((newRound || wentActive) && data.state === 'active' && !_cdShown) {
        _cdShown = true;
        const names = {
          trivia:    'WHO KNOWS VERONICA BETTER',
          redbutton: 'RED BUTTON',
          typewave:  'TYPEWAVE',
          stacker:   'STACKER',
          tapbattle: 'TAP BATTLE',
          betrayal:  'THE BETRAYAL VOTE',
          wheel:     'WHEEL OF FATE',
          hotpotato: 'HOT POTATO',
        };
        showCountdown(names[data.id] || 'GET READY');
      }
      if (data.state === 'ended' || data.state === 'waiting') _cdShown = false;
    }

    _prevRoundId    = data.id;
    _prevRoundState = data.state;

    if (data.id === 'trivia') {
      if (view === 'host')   renderHostTrivia(data, latestPlayersData);
      if (view === 'player') renderPlayerTrivia(data);
    }

    if (data.id === 'redbutton') {
      if (data.btnVisible && !_rbPrevBtnVisible) soundRbPop();
      _rbPrevBtnVisible = !!data.btnVisible;
      if (view === 'host')   renderHostRedButton(data, latestPlayersData);
      if (view === 'player') renderPlayerRedButton(data);
    }

    if (data.id === 'typewave') {
      if (view === 'host')   renderHostTypewave(data, latestPlayersData);
      if (view === 'player') renderPlayerTypewave(data);
    }

    if (data.id === 'stacker') {
      if (view === 'host')   renderHostStacker(data, latestPlayersData);
      if (view === 'player') renderPlayerStacker(data);

      // Auto-resolve when both scores land (host only)
      if (view === 'host' && data.state === 'active') {
        const sc = data.stackerScores ?? {};
        if (sc.player1 != null && sc.player2 != null && !stLocal.resolved) {
          stLocal.resolved = true;
          resolveStacker(data);
        }
      }
    }

    if (data.id === 'tapbattle') {
      if (view === 'host')   renderHostTapBattle(data, latestPlayersData);
      if (view === 'player') renderPlayerTapBattle(data);
    }

    if (data.id === 'betrayal') {
      if (view === 'host')   renderHostBetrayal(data, latestPlayersData);
      if (view === 'player') renderPlayerBetrayal(data);
    }

    if (data.id === 'wheel') {
      if (view === 'host')   renderHostWheel(data, latestPlayersData);
      if (view === 'player') renderPlayerWheel(data);
    }

    if (data.id === 'hotpotato') {
      if (view === 'host')   renderHostHotPotato(data, latestPlayersData);
      if (view === 'player') renderPlayerHotPotato(data);
    }
  });
} catch (err) {
  console.error('[Birthday Game] Round listener error:', err);
}

// ════════════════════════════════════════════════════════════
// FINALE
// ════════════════════════════════════════════════════════════
let _finaleFired = false;

function renderFinale(playersData, roundData) {
  if (!playersData) return;
  const p1 = playersData.player1 || {};
  const p2 = playersData.player2 || {};

  if (view === 'host') {
    const container = document.getElementById('host-finale-cards');
    if (!container) return;
    const m1   = roundData?.p1Multiplier ?? 1;
    const m2   = roundData?.p2Multiplier ?? 1;
    const pMax = (p1.points ?? 0) >= (p2.points ?? 0) ? 'player1' : 'player2';
    container.innerHTML = [
      { key: 'player1', p: p1, mult: m1 },
      { key: 'player2', p: p2, mult: m2 },
    ].map(({ key, p, mult }) => {
      const start    = p.startingPoints ?? 0;
      const final    = p.points ?? 0;
      const diff     = final - start;
      const diffClass= diff >= 0 ? 'fc-pos' : 'fc-neg';
      const diffSign = diff >= 0 ? '+' : '';
      return `
        <div class="finale-card${key === pMax ? ' fc-winner' : ''}">
          <div class="fc-name">${p.name || (key === 'player1' ? 'Player 1' : 'Player 2')}</div>
          <div class="fc-row"><span class="fc-label">Starting</span><span class="fc-value">${start} pts</span></div>
          <div class="fc-row"><span class="fc-label">Wheel</span><span class="fc-value">${mult}×</span></div>
          <div class="fc-row"><span class="fc-label">Final</span><span class="fc-value" style="color:var(--pink)">${final} pts</span></div>
          <div class="fc-row"><span class="fc-label">Change</span><span class="fc-value ${diffClass}">${diffSign}${Math.abs(diff)} pts</span></div>
        </div>`;
    }).join('');

    if (!_finaleFired) {
      _finaleFired = true;
      flashTransition('#FF69B4', 800);
      setTimeout(() => window.launchConfetti?.(), 400);
    }
  }

  if (view === 'player') {
    const container = document.getElementById('player-finale-cards');
    const outcomeEl = document.getElementById('player-finale-outcome');
    if (!container) return;

    const m1   = roundData?.p1Multiplier ?? 1;
    const m2   = roundData?.p2Multiplier ?? 1;
    const pMax = (p1.points ?? 0) >= (p2.points ?? 0) ? 'player1' : 'player2';

    container.innerHTML = [
      { key: 'player1', p: p1, mult: m1 },
      { key: 'player2', p: p2, mult: m2 },
    ].map(({ key, p, mult }) => {
      const start    = p.startingPoints ?? 0;
      const final    = p.points ?? 0;
      const diff     = final - start;
      const diffClass= diff >= 0 ? 'fc-pos' : 'fc-neg';
      const diffSign = diff >= 0 ? '+' : '';
      const isMe     = key === playerKey;
      return `
        <div class="finale-card${key === pMax ? ' fc-winner' : ''}">
          <div class="fc-name">${p.name || (key === 'player1' ? 'Player 1' : 'Player 2')}${isMe ? ' <span style="font-size:0.55em;color:var(--pink);letter-spacing:0.12em">(YOU)</span>' : ''}</div>
          <div class="fc-row"><span class="fc-label">Starting</span><span class="fc-value">${start} pts</span></div>
          <div class="fc-row"><span class="fc-label">Wheel</span><span class="fc-value">${mult}×</span></div>
          <div class="fc-row"><span class="fc-label">Final</span><span class="fc-value" style="color:var(--pink)">${final} pts</span></div>
          <div class="fc-row"><span class="fc-label">Change</span><span class="fc-value ${diffClass}">${diffSign}${Math.abs(diff)} pts</span></div>
        </div>`;
    }).join('');

    const myFinal  = (playersData[playerKey] || {}).points ?? 0;
    const oppKey   = playerKey === 'player1' ? 'player2' : 'player1';
    const oppFinal = (playersData[oppKey] || {}).points ?? 0;
    if (outcomeEl) {
      const winnerText  = myFinal > oppFinal ? 'YOU WIN!' : myFinal < oppFinal ? 'YOU LOSE' : "IT'S A TIE!";
      const winnerColor = myFinal > oppFinal ? 'var(--green)' : myFinal < oppFinal ? '#FF2D2D' : 'var(--pink)';
      outcomeEl.textContent = winnerText;
      outcomeEl.style.color = winnerColor;
    }

    const myStart = (playersData[playerKey] || {}).startingPoints ?? 0;
    if (!_finaleFired) {
      _finaleFired = true;
      if (myFinal > myStart) {
        flashTransition('#00FF87', 700);
        setTimeout(() => window.launchConfetti?.(), 300);
      } else if (myFinal === 0) {
        flashTransition('#FF2D2D', 700);
        setTimeout(() => soundElimination(), 200);
      } else {
        flashTransition('#FF69B4', 500);
        setTimeout(() => soundFanfare(), 300);
      }
    }
  }
}

// ════════════════════════════════════════════════════════════
// MASTER HOST CONTROL PANEL
// ════════════════════════════════════════════════════════════
if (view === 'host') {
  const ROUND_DISPLAY_NAMES = {
    trivia:    'Who Knows Me Better',
    redbutton: 'Red Button',
    typewave:  'Typewave',
    stacker:   'Stacker',
    tapbattle: 'Tap Battle',
    betrayal:  'The Betrayal Vote',
    typetest:  'Type Test',
    wheel:     'Wheel of Fate',
    hotpotato: 'Hot Potato',
  };

  let _mcGameData = null;

  const _mcPanel = document.getElementById('master-controls');
  if (_mcPanel) _mcPanel.classList.remove('hidden');

  const _mcTab = document.getElementById('mc-tab');
  if (_mcTab) {
    _mcTab.addEventListener('click', () => {
      _mcPanel.classList.toggle('mc-open');
    });
  }
  document.addEventListener('pointerdown', (e) => {
    if (_mcPanel && _mcPanel.classList.contains('mc-open') && !_mcPanel.contains(e.target)) {
      _mcPanel.classList.remove('mc-open');
    }
  }, { passive: true });

  const _hv = document.getElementById('host-view');
  if (_hv) _hv.style.paddingBottom = '60px';

  function updateMasterStatus() {
    const statusEl = document.getElementById('mc-status-text');
    if (!statusEl) return;
    const roundN  = _mcGameData?.currentRound ?? 0;
    const total   = ALL_ROUND_IDS.length;
    const roundId = ALL_ROUND_IDS[roundN - 1];
    const name    = roundId ? ROUND_DISPLAY_NAMES[roundId] : '';
    const state   = latestRoundData?.state ?? '—';
    if (!roundId || roundN === 0) {
      statusEl.innerHTML = `LOBBY — WAITING FOR PLAYERS`;
    } else {
      statusEl.innerHTML =
        `ROUND <span>${roundN}</span> / ${total} — ` +
        `<span>${name.toUpperCase()}</span> — ` +
        `STATUS: <span>${state.toUpperCase()}</span>`;
    }
  }

  onValue(ref(db, 'game'), (snap) => {
    _mcGameData = snap.val();
    updateMasterStatus();
  });

  onValue(ref(db, 'round'), () => { updateMasterStatus(); });

  function confirmAction(message, onConfirm) {
    const modal = document.createElement('div');
    modal.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.85);' +
      'display:flex;align-items:center;justify-content:center;' +
      'z-index:99999;font-family:var(--font-body);';
    modal.innerHTML = `
      <div style="background:#1a1a1a;border:2px solid var(--pink);
                  padding:32px;border-radius:12px;text-align:center;
                  max-width:400px;margin:16px;">
        <p style="color:white;font-size:18px;margin-bottom:24px;
                  font-family:var(--font-body);line-height:1.5;">${message}</p>
        <button id="mc-yes" style="background:var(--red);color:white;
                border:none;padding:12px 32px;font-size:16px;
                border-radius:8px;cursor:pointer;margin-right:12px;">
          Yes, do it
        </button>
        <button id="mc-no" style="background:#333;color:white;
                border:none;padding:12px 32px;font-size:16px;
                border-radius:8px;cursor:pointer;">
          Cancel
        </button>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#mc-yes').onclick = () => { modal.remove(); onConfirm(); };
    modal.querySelector('#mc-no').onclick  = () => modal.remove();
  }

  function buildRoundReset(roundId) {
    const base = {
      id: roundId, state: 'waiting', timer: 0,
      question: '', answers: { player1: null, player2: null }, winner: null,
      votes: null, stackerScores: null, typeScores: null, fps: null,
    };
    if (roundId === 'trivia')    Object.assign(base, { questionIndex: 0, scores: { player1: 0, player2: 0 } });
    if (roundId === 'redbutton') Object.assign(base, { subRound: 0, btnVisible: false, btnLeft: 50, btnTop: 50, btnShowTime: null, clicks: { player1: null, player2: null }, scores: { player1: 0, player2: 0 }, lastPointWinner: null });
    if (roundId === 'typewave')  Object.assign(base, { wordIndex: 0, scrambled: null, correctAnswer: null, wordWinner: null, wordStartTime: null, timedOut: false, wordScores: { player1: 0, player2: 0 }, wrongCounts: { player1: 0, player2: 0 }, lastAnswer: { player1: null, player2: null } });
    if (roundId === 'stacker')   Object.assign(base, { stackerLevels: { player1: 0, player2: 0 } });
    if (roundId === 'betrayal')  Object.assign(base, { votes: { player1: null, player2: null } });
    if (roundId === 'typetest')  Object.assign(base, { passage: null, ttStartTime: null, typeScores: { player1: null, player2: null } });
    if (roundId === 'wheel')     Object.assign(base, { p1Multiplier: null, p2Multiplier: null, targetSegment: null });
    if (roundId === 'hotpotato') Object.assign(base, { holder: 'player1', bombTime: null, passCount: 0, loser: null, winner: null });
    return base;
  }

  async function prevRound() {
    if (!_mcGameData || !_mcGameData.currentRound) {
      alert('Cannot go back — not currently in a round.'); return;
    }
    const currentN = _mcGameData.currentRound;
    if (currentN <= 1) { alert('Already on Round 1 — cannot go back further.'); return; }
    const newN  = currentN - 1;
    const newId = ALL_ROUND_IDS[newN - 1];
    confirmAction(
      `Go back to Round ${newN}: ${ROUND_DISPLAY_NAMES[newId]}?<br>
       <small style="color:#888">This will reset that round's data.</small>`,
      async () => {
        try {
          await update(ref(db, 'game'), { currentRound: newN, phase: 'round' });
          await set(ref(db, 'round'), buildRoundReset(newId));
        } catch (e) { console.error('[MC] prevRound:', e); }
      }
    );
  }

  async function skipRound() {
    const currentN = _mcGameData?.currentRound ?? 1;
    const newN     = Math.min(ALL_ROUND_IDS.length, currentN + 1);
    const newId    = ALL_ROUND_IDS[newN - 1];
    confirmAction(
      `Skip to Round ${newN}: ${ROUND_DISPLAY_NAMES[newId]}?<br>
       <small style="color:#888">Current round data will be lost.</small>`,
      async () => {
        try {
          await update(ref(db, 'game'), { currentRound: newN, phase: 'round' });
          await set(ref(db, 'round'), buildRoundReset(newId));
        } catch (e) { console.error('[MC] skipRound:', e); }
      }
    );
  }

  async function restartRound() {
    const currentN = _mcGameData?.currentRound ?? 1;
    const roundId  = ALL_ROUND_IDS[currentN - 1];
    const name     = roundId ? ROUND_DISPLAY_NAMES[roundId] : 'current round';
    confirmAction(
      `Restart ${name}?<br>
       <small style="color:#888">All progress will be lost.</small>`,
      async () => {
        try {
          await set(ref(db, 'round'), buildRoundReset(roundId));
        } catch (e) { console.error('[MC] restartRound:', e); }
      }
    );
  }

  async function goToFinale() {
    confirmAction(
      `Jump to finale (Wheel of Fate)?<br>
       <small style="color:#888">All remaining rounds will be skipped.</small>`,
      async () => {
        try {
          const wheelN = ALL_ROUND_IDS.indexOf('wheel') + 1;
          await update(ref(db, 'game'), { currentRound: wheelN, phase: 'round' });
          await set(ref(db, 'round'), buildRoundReset('wheel'));
        } catch (e) { console.error('[MC] goToFinale:', e); }
      }
    );
  }

  function toggleMoneyEditor() {
    document.getElementById('money-editor')?.classList.toggle('hidden');
    _mcPanel?.classList.add('mc-open');
  }

  function logMoneyAction(msg) {
    const log = document.getElementById('me-log');
    if (!log) return;
    const t   = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const row = document.createElement('div');
    row.className = 'me-log-entry';
    row.innerHTML = `<span>[${t}]</span> ${msg}`;
    log.prepend(row);
  }

  function updateMoneyEditorBalances(playersData) {
    if (!playersData) return;
    const p1 = playersData.player1 || {};
    const p2 = playersData.player2 || {};
    const n1El = document.getElementById('me-p1-name');
    const n2El = document.getElementById('me-p2-name');
    const b1El = document.getElementById('me-p1-bal');
    const b2El = document.getElementById('me-p2-bal');
    if (n1El) n1El.textContent = p1.name || 'Player 1';
    if (n2El) n2El.textContent = p2.name || 'Player 2';
    if (b1El) b1El.textContent = `${p1.points ?? 0} pts`;
    if (b2El) b2El.textContent = `${p2.points ?? 0} pts`;
  }

  onValue(ref(db, 'players'), (snap) => { updateMoneyEditorBalances(snap.val()); });

  async function adjustMoney(pk, delta) {
    try {
      const snap   = await get(ref(db, `players/${pk}`));
      const pData  = snap.val() || {};
      const oldBal = pData.points ?? 0;
      const newBal = Math.max(0, Math.round(oldBal + delta));
      await update(ref(db, `players/${pk}`), { points: newBal });
      const name = pData.name || pk;
      const sign = delta >= 0 ? `+${delta} pts` : `${delta} pts`;
      logMoneyAction(`Host adjusted ${name} ${sign} → ${newBal} pts`);
    } catch (e) { console.error('[MC] adjustMoney:', e); }
  }

  async function setMoney(pk, value) {
    try {
      const newBal = Math.max(0, Math.round(Number(value)));
      if (isNaN(newBal)) return;
      const snap  = await get(ref(db, `players/${pk}`));
      const pData = snap.val() || {};
      const name  = pData.name || pk;
      await update(ref(db, `players/${pk}`), { points: newBal });
      logMoneyAction(`Host set ${name} to ${newBal} pts`);
    } catch (e) { console.error('[MC] setMoney:', e); }
  }

  async function doNuclearReset() {
    try {
      const playersInit = {};
      PLAYER_KEYS.forEach(k => {
        playersInit[k] = { name: '', points: 0, startingPoints: 0, alive: true, answer: null, ready: false };
      });
      await set(ref(db, '/'), {
        game:    { phase: 'lobby', currentRound: 0, roundActive: false },
        players: playersInit,
        round:   null,
        wheel:   null,
        fps:     null,
      });
      _finaleFired = false;
    } catch (e) { console.error('[MC] nuclearReset:', e); }
  }

  function armResetBtn(btn, defaultLabel) {
    let armed = false, timer = null;
    btn.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        btn.textContent = '⚠️ CLICK AGAIN TO CONFIRM';
        btn.classList.add('armed');
        timer = setTimeout(() => {
          armed = false;
          btn.textContent = defaultLabel;
          btn.classList.remove('armed');
        }, 3000);
      } else {
        clearTimeout(timer);
        armed = false;
        btn.textContent = defaultLabel;
        btn.classList.remove('armed');
        doNuclearReset();
      }
    });
  }

  const _nuclearBtn = document.getElementById('mc-btn-nuclear');
  if (_nuclearBtn) armResetBtn(_nuclearBtn, '🔴 RESET GAME');

  const _finaleRestartBtn = document.getElementById('btn-finale-restart');
  if (_finaleRestartBtn) armResetBtn(_finaleRestartBtn, '🔄 RESTART ENTIRE GAME');

  document.getElementById('mc-btn-prev')   ?.addEventListener('click', prevRound);
  document.getElementById('mc-btn-skip')   ?.addEventListener('click', skipRound);
  document.getElementById('mc-btn-restart')?.addEventListener('click', restartRound);
  document.getElementById('mc-btn-finale') ?.addEventListener('click', goToFinale);
  document.getElementById('mc-btn-toggle-money')?.addEventListener('click', toggleMoneyEditor);

  document.querySelectorAll('.me-adj-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      adjustMoney(btn.dataset.player, parseInt(btn.dataset.adj, 10));
    });
  });

  document.querySelectorAll('.me-apply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pk    = btn.dataset.player;
      const input = document.getElementById(pk === 'player1' ? 'me-p1-input' : 'me-p2-input');
      if (input && input.value !== '') {
        setMoney(pk, input.value);
        input.value = '';
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'ArrowRight') { e.preventDefault(); skipRound(); }
    if (e.ctrlKey && e.code === 'ArrowLeft')  { e.preventDefault(); prevRound(); }
    if (e.ctrlKey && e.code === 'KeyR')        { e.preventDefault(); restartRound(); }
    if (e.ctrlKey && e.code === 'KeyM')        { e.preventDefault(); toggleMoneyEditor(); }
  });
}

// ════════════════════════════════════════════════════════════
// CONTEXT OBJECT + INIT ALL ROUND MODULES
// ════════════════════════════════════════════════════════════
const ctx = {
  db, ref, set, get, update, onValue,
  view,
  playerKey,
  PLAYER_KEYS,
  POINT_EVENTS,
  MONEY_EVENTS,
  ALL_ROUND_IDS,
  ROUND_NAMES,
  animateMoneyChange,
  flashTransition,
  roundWipeTransition,
  showCountdown,
  playTone,
  soundClick,
  soundFanfare,
  soundElimination,
  soundMoneyUp,
  soundMoneyDown,
  getLatestRoundData:   () => latestRoundData,
  getLatestPlayersData: () => latestPlayersData,
};

initTrivia(ctx);
initRedButton(ctx);
initTypewave(ctx);
initStacker(ctx);
initTapBattle(ctx);
initBetrayal(ctx);
initWheel(ctx);
initHotPotato(ctx);

// Expose shared state for debugging / external tools
window._mbGame = {
  db, ref, set, get, update, onValue,
  MONEY_EVENTS,
  ROUND_ORDER: ALL_ROUND_IDS,
  ROUND_NAMES,
  animateMoneyChange,
  flashTransition,
  playerKey,
  view,
};
