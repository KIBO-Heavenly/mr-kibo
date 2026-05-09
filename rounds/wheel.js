// ════════════════════════════════════════════════════════════
// ROUND 7 — WHEEL OF FATE
// ════════════════════════════════════════════════════════════

let _ctx;

const WHEEL_SEGMENTS = [
  { label: '0.5×  💀',  multiplier: 0.5,  color: '#FF2D2D' },   // red
  { label: '0.75× 😬',  multiplier: 0.75, color: '#CC5500' },   // burnt orange
  { label: '1×    😐',  multiplier: 1.0,  color: '#2a2a2a' },   // dark neutral
  { label: '1×    😐',  multiplier: 1.0,  color: '#3d3d3d' },   // dark neutral alt
  { label: '1.25× 😏',  multiplier: 1.25, color: '#00AA55' },   // green
  { label: '2×    🎉',  multiplier: 2.0,  color: '#FFD700' },   // gold
];

class SpinWheel {
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.angle   = 0;   // current rotation (radians)
    this.spinning = false;
    this.raf     = null;
    this._resize();
    this.draw();
  }

  _resize() {
    const side = Math.min(340, window.innerWidth - 48);
    this.canvas.width  = side;
    this.canvas.height = side;
  }

  spin(targetSegmentIndex, onComplete) {
    if (this.spinning) return;
    this.spinning = true;

    const n        = WHEEL_SEGMENTS.length;
    const segAngle = (Math.PI * 2) / n;
    // We want the middle of targetSegment at the top (−π/2)
    const targetAngle = -Math.PI / 2 - (targetSegmentIndex + 0.5) * segAngle;
    let delta = ((targetAngle - this.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    if (delta < 0.01) delta += Math.PI * 2;
    delta += Math.PI * 2 * 4; // 4 extra full spins

    const startAngle = this.angle;
    const endAngle   = startAngle + delta;
    const duration   = 4000;
    const startTime  = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const ease = 1 - Math.pow(1 - t, 4);
      this.angle = startAngle + delta * ease;
      this.draw();

      if (t < 1) {
        this.raf = requestAnimationFrame(tick);
      } else {
        this.angle    = endAngle;
        this.spinning = false;
        this.draw();
        if (onComplete) onComplete();
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const W   = this.canvas.width;
    const cx  = W / 2;
    const cy  = W / 2;
    const r   = W / 2 - 4;
    const n   = WHEEL_SEGMENTS.length;
    const seg = (Math.PI * 2) / n;
    ctx.clearRect(0, 0, W, W);

    WHEEL_SEGMENTS.forEach((s, i) => {
      const startA = this.angle + i * seg;
      const endA   = startA + seg;

      // wedge fill
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startA, endA);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();

      // subtle border
      ctx.strokeStyle = '#000';
      ctx.lineWidth   = 2;
      ctx.stroke();

      // label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startA + seg / 2);
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = '#fff';
      ctx.font         = `bold ${Math.floor(W * 0.065)}px 'Bebas Neue', sans-serif`;
      ctx.shadowColor  = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur   = 4;
      ctx.fillText(s.label, r - 10, 0);
      ctx.restore();
    });

    // center cap
    ctx.beginPath();
    ctx.arc(cx, cy, W * 0.1, 0, Math.PI * 2);
    ctx.fillStyle   = '#0a0a0a';
    ctx.fill();
    ctx.strokeStyle = '#FF69B4';
    ctx.lineWidth   = 4;
    ctx.stroke();

    // outer rim
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#FF69B4';
    ctx.lineWidth   = 4;
    ctx.stroke();
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }
}

// ── Wheel local state ──────────────────────────────────────
let wlWheel       = null;  // SpinWheel on host canvas
let wlPWheel      = null;  // SpinWheel on player canvas (my turn)
let wlPWatchWheel = null;  // SpinWheel on player watch canvas
let wlHostSpinDone = { player1: false, player2: false };
let wlLastState    = null;  // tracks previous wheel state
let wlPSpinDone    = false; // player-side guard

function pickRandomSegment() {
  return Math.floor(Math.random() * WHEEL_SEGMENTS.length);
}

// ── Render: host wheel ─────────────────────────────────────
export function renderHostWheel(data, playersData) {
  if (!data) return;
  const state = data.state || 'waiting';

  const prestart = document.getElementById('wl-prestart');
  const active   = document.getElementById('wl-active');
  if (!prestart || !active) return;

  if (state === 'waiting') {
    prestart.classList.remove('hidden');
    active.classList.add('hidden');
    return;
  }

  prestart.classList.add('hidden');
  active.classList.remove('hidden');

  // Populate player cards
  if (playersData) {
    const p1 = playersData.player1 || {};
    const p2 = playersData.player2 || {};
    const n1 = document.getElementById('wl-name-p1');
    const n2 = document.getElementById('wl-name-p2');
    const b1 = document.getElementById('wl-bal-p1');
    const b2 = document.getElementById('wl-bal-p2');
    if (n1) n1.textContent = p1.name || 'Player 1';
    if (n2) n2.textContent = p2.name || 'Player 2';
    if (b1) b1.textContent = `${p1.points ?? 0} pts`;
    if (b2) b2.textContent = `${p2.points ?? 0} pts`;
  }

  // Show multiplier results if already spun
  const m1El = document.getElementById('wl-mult-p1');
  const m2El = document.getElementById('wl-mult-p2');
  if (data.p1Multiplier !== undefined && data.p1Multiplier !== null && m1El) {
    m1El.textContent = `${data.p1Multiplier}×`;
    m1El.classList.remove('hidden');
  }
  if (data.p2Multiplier !== undefined && data.p2Multiplier !== null && m2El) {
    m2El.textContent = `${data.p2Multiplier}×`;
    m2El.classList.remove('hidden');
  }

  // Card highlight
  const c1 = document.getElementById('wl-card-p1');
  const c2 = document.getElementById('wl-card-p2');
  if (c1 && c2) {
    c1.className = 'wl-player-card' + (
      (state === 'p1_ready' || state === 'p1_spinning') ? ' wl-active-player' :
      (data.p1Multiplier != null) ? ' wl-done-player' : '');
    c2.className = 'wl-player-card' + (
      (state === 'p2_ready' || state === 'p2_spinning') ? ' wl-active-player' :
      (data.p2Multiplier != null) ? ' wl-done-player' : '');
  }

  const sp1 = document.getElementById('btn-wl-spin-p1');
  const sp2 = document.getElementById('btn-wl-spin-p2');
  const ep1 = document.getElementById('btn-wl-enable-p1');
  const ep2 = document.getElementById('btn-wl-enable-p2');
  const applyBtn    = document.getElementById('btn-wl-apply');
  const spinLabel   = document.getElementById('wl-host-spin-label');
  const resultBanner= document.getElementById('wl-host-result-banner');

  // Init wheel canvas once
  if (!wlWheel) {
    const canvas = document.getElementById('wl-canvas');
    if (canvas) wlWheel = new SpinWheel(canvas);
  }

  if (state === 'p1_ready') {
    if (sp1) { sp1.disabled = false; sp1.classList.remove('hidden'); }
    if (sp2) { sp2.disabled = true; }
    if (ep1) ep1.classList.add('hidden');
    if (ep2) ep2.classList.add('hidden');
    if (applyBtn) applyBtn.classList.add('hidden');
    if (spinLabel) spinLabel.textContent = '';
    if (resultBanner) resultBanner.classList.add('hidden');

    if (sp1 && !sp1._wlBound) {
      sp1._wlBound = true;
      sp1.addEventListener('click', async () => {
        sp1.disabled = true;
        const seg = pickRandomSegment();
        try {
          await _ctx.update(_ctx.ref(_ctx.db, 'round'), { state: 'p1_spinning', targetSegment: seg });
        } catch(e) { console.error(e); sp1.disabled = false; }
      });
    }
  }

  if (state === 'p1_spinning' && !wlHostSpinDone.player1 && data.p1Multiplier == null) {
    wlHostSpinDone.player1 = true;
    if (spinLabel) spinLabel.textContent = 'SPINNING…';
    if (resultBanner) resultBanner.classList.add('hidden');
    const seg = data.targetSegment ?? 0;
    if (wlWheel) {
      wlWheel.spin(seg, async () => {
        const mult = WHEEL_SEGMENTS[seg].multiplier;
        if (spinLabel) spinLabel.textContent = '';
        if (resultBanner) {
          resultBanner.textContent = `P1: ${mult}×`;
          resultBanner.classList.remove('hidden');
        }
        try {
          // Guard against double-write
          if (_ctx.getLatestRoundData()?.p1Multiplier == null) {
            await _ctx.update(_ctx.ref(_ctx.db, 'round'), {
              p1Multiplier: mult,
              state: 'p2_ready',
            });
          }
        } catch(e) { console.error(e); }
      });
    }
  }

  if (state === 'p2_ready') {
    if (sp1) sp1.disabled = true;
    if (sp2) { sp2.disabled = false; sp2.classList.remove('hidden'); }
    if (ep1) ep1.classList.add('hidden');
    if (ep2) ep2.classList.add('hidden');
    if (applyBtn) applyBtn.classList.add('hidden');

    if (sp2 && !sp2._wlBound) {
      sp2._wlBound = true;
      sp2.addEventListener('click', async () => {
        sp2.disabled = true;
        const seg = pickRandomSegment();
        try {
          await _ctx.update(_ctx.ref(_ctx.db, 'round'), { state: 'p2_spinning', targetSegment: seg });
        } catch(e) { console.error(e); sp2.disabled = false; }
      });
    }
  }

  if (state === 'p2_spinning' && !wlHostSpinDone.player2 && data.p2Multiplier == null) {
    wlHostSpinDone.player2 = true;
    if (spinLabel) spinLabel.textContent = 'SPINNING…';
    const seg = data.targetSegment ?? 0;
    if (wlWheel) {
      wlWheel.spin(seg, async () => {
        const mult = WHEEL_SEGMENTS[seg].multiplier;
        if (spinLabel) spinLabel.textContent = '';
        if (resultBanner) {
          resultBanner.textContent = `P2: ${mult}×`;
          resultBanner.classList.remove('hidden');
        }
        try {
          // Guard against double-write
          if (_ctx.getLatestRoundData()?.p2Multiplier == null) {
            await _ctx.update(_ctx.ref(_ctx.db, 'round'), {
              p2Multiplier: mult,
              state: 'p2_done',
            });
          }
        } catch(e) { console.error(e); }
      });
    }
  }

  if (state === 'p2_done') {
    if (sp1) sp1.disabled = true;
    if (sp2) sp2.disabled = true;
    if (applyBtn) {
      applyBtn.classList.remove('hidden');
      if (!applyBtn._wlBound) {
        applyBtn._wlBound = true;
        applyBtn.addEventListener('click', async () => {
          applyBtn.disabled = true;
          const pd = _ctx.getLatestPlayersData() || {};
          const p1 = pd.player1 || {};
          const p2 = pd.player2 || {};
          const m1 = data.p1Multiplier ?? 1;
          const m2 = data.p2Multiplier ?? 1;
          const newBal1 = Math.max(0, Math.round((p1.points ?? 0) * m1));
          const newBal2 = Math.max(0, Math.round((p2.points ?? 0) * m2));
          try {
            await _ctx.update(_ctx.ref(_ctx.db, 'players/player1'), { points: newBal1, alive: newBal1 > 0 });
            await _ctx.update(_ctx.ref(_ctx.db, 'players/player2'), { points: newBal2, alive: newBal2 > 0 });
            const hpN = _ctx.ALL_ROUND_IDS.indexOf('hotpotato') + 1;
            await _ctx.update(_ctx.ref(_ctx.db, 'game'), { currentRound: hpN, phase: 'round' });
            await _ctx.update(_ctx.ref(_ctx.db, 'round'), { state: 'ended' });
            _ctx.flashTransition('#FF69B4', 600);
          } catch(e) { console.error(e); applyBtn.disabled = false; }
        });
      }
    }
  }
}

// ── Render: player wheel ───────────────────────────────────
export function renderPlayerWheel(data) {
  if (!data) return;
  const state = data.state || 'waiting';

  const waiting  = document.getElementById('wl-p-waiting');
  const ready    = document.getElementById('wl-p-ready');
  const watching = document.getElementById('wl-p-watching');
  const myResult = document.getElementById('wl-p-my-result');
  if (!waiting) return;

  const myTurn   = (_ctx.playerKey === 'player1' && (state === 'p1_ready' || state === 'p1_spinning'))
                || (_ctx.playerKey === 'player2' && (state === 'p2_ready' || state === 'p2_spinning'));
  const theirTurn = (_ctx.playerKey === 'player1' && (state === 'p2_ready' || state === 'p2_spinning'))
                 || (_ctx.playerKey === 'player2' && (state === 'p1_ready' || state === 'p1_spinning'));
  const myMultKey    = _ctx.playerKey === 'player1' ? 'p1Multiplier' : 'p2Multiplier';
  const myMult       = data[myMultKey];
  const mySpunAlready = myMult !== undefined && myMult !== null;

  // Show my result section if I've already spun
  if (mySpunAlready && !myTurn) {
    waiting.classList.add('hidden');
    ready.classList.add('hidden');
    watching.classList.add('hidden');
    myResult.classList.remove('hidden');
    const mv = document.getElementById('wl-p-my-mult-value');
    if (mv) mv.textContent = `${myMult}×`;
    return;
  }

  if (myTurn) {
    waiting.classList.add('hidden');
    ready.classList.remove('hidden');
    watching.classList.add('hidden');
    myResult.classList.add('hidden');

    if (!wlPWheel) {
      const canvas = document.getElementById('wl-p-canvas');
      if (canvas) wlPWheel = new SpinWheel(canvas);
    }

    const spinLabel = document.getElementById('wl-p-spin-label');
    const spinBtn   = document.getElementById('btn-wl-p-spin');

    if ((state === 'p1_spinning' && _ctx.playerKey === 'player1') ||
        (state === 'p2_spinning' && _ctx.playerKey === 'player2')) {
      if (!wlPSpinDone) {
        wlPSpinDone = true;
        if (spinBtn) spinBtn.classList.add('hidden');
        if (spinLabel) spinLabel.textContent = 'SPINNING…';
        const seg = data.targetSegment ?? 0;
        if (wlPWheel) {
          wlPWheel.spin(seg, () => {
            const mult = WHEEL_SEGMENTS[seg].multiplier;
            if (spinLabel) spinLabel.textContent = `YOU GOT ${mult}×!`;
          });
        }
      }
    } else {
      // Ready state — show spin button
      if (spinBtn) {
        spinBtn.classList.remove('hidden');
        spinBtn.disabled = false;
        if (!spinBtn._wlBound) {
          spinBtn._wlBound = true;
          spinBtn.addEventListener('click', async () => {
            spinBtn.disabled = true;
            const seg = pickRandomSegment();
            const stateKey = _ctx.playerKey === 'player1' ? 'p1_spinning' : 'p2_spinning';
            try {
              await _ctx.update(_ctx.ref(_ctx.db, 'round'), { state: stateKey, targetSegment: seg });
            } catch(e) { console.error(e); spinBtn.disabled = false; }
          });
        }
      }
    }
    return;
  }

  if (theirTurn) {
    waiting.classList.add('hidden');
    ready.classList.add('hidden');
    watching.classList.remove('hidden');
    myResult.classList.add('hidden');

    if (!wlPWatchWheel) {
      const canvas = document.getElementById('wl-p-watch-canvas');
      if (canvas) wlPWatchWheel = new SpinWheel(canvas);
    }

    const watchLabel = document.getElementById('wl-p-watch-label');
    const isSpinning = (state === 'p1_spinning' && _ctx.playerKey === 'player2') ||
                       (state === 'p2_spinning' && _ctx.playerKey === 'player1');
    if (isSpinning && wlPWatchWheel && !wlPWatchWheel.spinning && wlLastState !== state) {
      wlLastState = state;
      const seg = data.targetSegment ?? 0;
      if (watchLabel) watchLabel.textContent = 'SPINNING…';
      wlPWatchWheel.spin(seg, () => {
        const mult = WHEEL_SEGMENTS[seg].multiplier;
        if (watchLabel) watchLabel.textContent = `THEY GOT ${mult}×!`;
      });
    }
    return;
  }

  // Default: waiting
  waiting.classList.remove('hidden');
  ready.classList.add('hidden');
  watching.classList.add('hidden');
  myResult.classList.add('hidden');
}

// ── Module init — called from main.js ─────────────────────
export function init(ctx) {
  _ctx = ctx;

  // HOST: START WHEEL ROUND (bound at page load)
  const btnWlStartStandalone = document.getElementById('btn-wl-start');
  if (btnWlStartStandalone) {
    btnWlStartStandalone.addEventListener('click', async () => {
      btnWlStartStandalone.disabled = true;
      // Reset spin-done guards for new game
      wlHostSpinDone = { player1: false, player2: false };
      wlPSpinDone    = false;
      wlLastState    = null;
      if (wlWheel) { wlWheel.destroy(); wlWheel = null; }
      if (wlPWheel) { wlPWheel.destroy(); wlPWheel = null; }
      if (wlPWatchWheel) { wlPWatchWheel.destroy(); wlPWatchWheel = null; }
      try {
        _ctx.flashTransition('var(--pink)', 500);
        await _ctx.set(_ctx.ref(_ctx.db, 'round'), {
          id: 'wheel', state: 'p1_ready',
          p1Multiplier: null, p2Multiplier: null,
          targetSegment: null,
          answers: {}, stackerScores: {}, timer: 0, question: '',
        });
      } catch(e) {
        console.error('[Wheel] Start error:', e);
        btnWlStartStandalone.disabled = false;
      }
    });
  }
}
