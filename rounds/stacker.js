// ════════════════════════════════════════════════════════════
// ROUND 4 — STACKER (arcade block-drop, 12 levels)
// ════════════════════════════════════════════════════════════

let _ctx;
let btnStStart; // referenced in both init() and renderHostStacker()

const ST_BLOCK_COLORS = [
  '#00FF87','#1DF07A','#3AE16D','#57D260',
  '#74C353','#91B446','#AEA539','#CB962C',
  '#E8871F','#FF7812','#FF5005','#FFD700',
];

class Stacker {
  constructor(canvas, opts = {}) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.onEnd   = opts.onEnd   || (() => {});
    this.onLevel = opts.onLevel || (() => {});
    this.ROWS    = 12;
    this.done    = false;
    this.won     = false;
    this.raf     = null;
    this._lastTs = null;
    this._dropDebounce = false;
    this._flashText = null;
    this._flashAlpha = 0;

    // devicePixelRatio-aware canvas sizing
    const dpr = window.devicePixelRatio || 1;
    const isMobile = window.innerWidth < 480;
    const displayW = isMobile ? 300 : 320;
    const displayH = isMobile ? 480 : 520;
    canvas.width  = displayW * dpr;
    canvas.height = displayH * dpr;
    canvas.style.width  = displayW + 'px';
    canvas.style.height = displayH + 'px';
    this.ctx.scale(dpr, dpr);
    this.displayW = displayW;
    this.displayH = displayH;

    this.ROW_H = Math.floor(displayH / this.ROWS);

    // Initial base block (centered, 60% wide)
    const initW  = Math.floor(displayW * 0.60);
    const initX  = Math.floor((displayW - initW) / 2);
    this.stack   = [{ x: initX, w: initW, color: ST_BLOCK_COLORS[0] }];
    this.level   = 1;

    // Moving block state
    this.mx   = 0;
    this.mw   = initW;
    this.mdir = 1;

    // Input (click + touchstart, debounced)
    this._onClick = () => this.drop();
    this._onTouch = (e) => { e.preventDefault(); this.drop(); };
    canvas.addEventListener('click',      this._onClick);
    canvas.addEventListener('touchstart', this._onTouch, { passive: false });

    this.loop(performance.now());
  }

  _speedPxPerSec() {
    // 120px/s base, +15 per level, capped at 400
    return Math.min(400, 120 + (this.level - 1) * 15);
  }

  _resetMoving() {
    const prev = this.stack[this.stack.length - 1];
    this.mw   = prev.w;
    // Start centered above the placed block so the block doesn't snap to far left
    this.mx   = Math.max(0, Math.floor(prev.x + (prev.w - this.mw) / 2));
    this.mdir = Math.random() < 0.5 ? 1 : -1;
  }

  drop() {
    if (this.done || this._dropDebounce) return;
    this._dropDebounce = true;
    setTimeout(() => { this._dropDebounce = false; }, 100);

    const prev = this.stack[this.stack.length - 1];
    const olStart = Math.max(prev.x, this.mx);
    const olEnd   = Math.min(prev.x + prev.w, this.mx + this.mw);
    const ow      = olEnd - olStart;

    if (ow < 4) {
      // Miss
      this.done = true;
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
      this._setFlash('MISSED! ❌', '#FF2D2D');
      this._drawEndOverlay(false);
      this.onEnd(this.level - 1, false);
      return;
    }

    // Visual feedback based on alignment quality
    const trimmed = prev.w - ow;
    if (trimmed <= 5)       this._setFlash('PERFECT ⭐', '#FFD700');
    else if (trimmed <= 20) this._setFlash('NICE! ✓',   '#00FF87');
    else                    this._setFlash('CLOSE 😬',   '#FF8C00');

    const colorIdx = Math.min(this.stack.length, ST_BLOCK_COLORS.length - 1);
    this.stack.push({ x: olStart, w: ow, color: ST_BLOCK_COLORS[colorIdx] });
    this.onLevel(this.level);
    this.level++;

    if (this.level > this.ROWS) {
      this.won  = true;
      this.done = true;
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
      this.draw();
      this._drawEndOverlay(true);
      this.onEnd(this.ROWS, true);
      return;
    }

    this._resetMoving();
  }

  _setFlash(text, color) {
    this._flashText  = text;
    this._flashColor = color;
    this._flashAlpha = 1;
  }

  update(deltaMs) {
    if (this.done) return;
    const dx = this._speedPxPerSec() * (deltaMs / 1000);
    this.mx += dx * this.mdir;
    const maxX = this.displayW - this.mw;
    if      (this.mx >= maxX) { this.mx = maxX; this.mdir = -1; }
    else if (this.mx <= 0)    { this.mx = 0;    this.mdir =  1; }
  }

  draw() {
    const { ctx, displayW: W, displayH: H, ROWS, ROW_H, stack, done } = this;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#181818';
    ctx.lineWidth   = 1;
    for (let r = 0; r <= ROWS; r++) {
      const y = H - r * ROW_H;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Active-row tint
    if (!done) {
      const movRow = stack.length;
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(0, H - (movRow + 1) * ROW_H, W, ROW_H);
    }

    // Placed blocks
    stack.forEach((block, i) => {
      const y = H - (i + 1) * ROW_H + 1;
      const h = ROW_H - 2;
      ctx.fillStyle = block.color;
      ctx.fillRect(block.x, y, block.w, h);
      // Shine + shadow
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(block.x, y, block.w, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(block.x + block.w - 3, y + 3, 3, h - 3);
      // White outline on top block
      if (i === stack.length - 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth   = 1;
        ctx.strokeRect(block.x + 0.5, y + 0.5, block.w - 1, h - 1);
      }
    });

    // Moving block
    if (!done) {
      const movRow = stack.length;
      const y = H - (movRow + 1) * ROW_H + 1;
      const h = ROW_H - 2;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(this.mx, y, this.mw, h);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(this.mx, y, this.mw, 3);
    }

    // Level labels
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let r = 1; r <= ROWS; r++) {
      ctx.fillStyle = r === stack.length ? '#555' : '#222';
      ctx.fillText(r, W - 3, H - r * ROW_H + ROW_H / 2);
    }

    // Flash feedback text
    if (this._flashAlpha > 0) {
      ctx.globalAlpha = this._flashAlpha;
      ctx.fillStyle   = this._flashColor || '#fff';
      ctx.font        = `bold ${Math.round(W * 0.085)}px sans-serif`;
      ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this._flashText, W / 2, H * 0.15);
      ctx.globalAlpha = 1;
      this._flashAlpha = Math.max(0, this._flashAlpha - 0.04);
    }
  }

  _drawEndOverlay(won) {
    this.draw();
    const { ctx, displayW: W, displayH: H } = this;
    ctx.fillStyle = won ? 'rgba(0,255,135,0.18)' : 'rgba(255,45,45,0.18)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle    = won ? '#00FF87' : '#FF2D2D';
    ctx.font         = `bold ${Math.round(W * 0.12)}px sans-serif`;
    ctx.textAlign    = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(won ? 'PERFECT! ⭐' : 'GAME OVER', W / 2, H / 2);
  }

  loop(ts) {
    const delta = this._lastTs != null ? ts - this._lastTs : 16;
    this._lastTs = ts;
    this.update(Math.min(delta, 100)); // clamp to avoid huge jumps
    this.draw();
    if (!this.done) this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  destroy() {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
    this.canvas.removeEventListener('click',      this._onClick);
    this.canvas.removeEventListener('touchstart', this._onTouch);
  }
}

// ── Ephemeral state ────────────────────────────────────────
// stLocal is exported so main.js can check stLocal.resolved in the /round listener
export let stLocal       = { resolved: false, resultApplied: false };
let stGame        = null;
let stGameStarted = false;

// ── Render: host stacker ───────────────────────────────────
export function renderHostStacker(data, playersData) {
  if (!data || data.id !== 'stacker') return;

  const state  = data.state         ?? 'waiting';
  const scores = data.stackerScores ?? {};
  const levels = data.stackerLevels ?? {};
  const p1name = playersData?.player1?.name || 'Player 1';
  const p2name = playersData?.player2?.name || 'Player 2';

  // Names
  ['st-host-p1-name','st-rmc-name-p1'].forEach(id => {
    const e = document.getElementById(id); if (e) e.textContent = p1name;
  });
  ['st-host-p2-name','st-rmc-name-p2'].forEach(id => {
    const e = document.getElementById(id); if (e) e.textContent = p2name;
  });

  // Section visibility
  document.getElementById('st-prestart')?.classList.toggle('hidden', state !== 'waiting');
  document.getElementById('st-active')  ?.classList.toggle('hidden', state !== 'active');
  document.getElementById('st-ended')   ?.classList.toggle('hidden', state !== 'ended');
  if (state === 'waiting' && btnStStart) btnStStart.disabled = false;

  if (state === 'active') {
    [['p1','player1'],['p2','player2']].forEach(([p, pKey]) => {
      const score    = scores[pKey];
      const level    = levels[pKey] ?? 0;
      const levelEl  = document.getElementById(`st-host-${p}-level`);
      const statusEl = document.getElementById(`st-host-${p}-status`);
      const cardEl   = document.getElementById(`st-host-${p}-card`);

      if (score != null) {
        if (levelEl)  levelEl.textContent  = `${score}/12`;
        if (statusEl) statusEl.textContent = score >= 12 ? 'PERFECT! ✓' : `Done — ${score}/12`;
        cardEl?.classList.add('st-done');
      } else {
        if (levelEl)  levelEl.textContent  = level;
        if (statusEl) statusEl.textContent = level > 0 ? `Level ${level} — Playing…` : 'Waiting to start…';
        cardEl?.classList.remove('st-done');
      }
    });

    const msgEl    = document.getElementById('st-waiting-msg');
    const bothDone = scores.player1 != null && scores.player2 != null;
    if (msgEl) msgEl.textContent = bothDone
      ? 'Both players done! Resolving…'
      : 'Waiting for both players to finish…';
  }

  if (state === 'ended') {
    const winner = data.winner;
    const s1     = scores.player1 ?? 0;
    const s2     = scores.player2 ?? 0;
    const wName  = winner === 'player1' ? p1name : winner === 'player2' ? p2name : null;

    const winnerEl = document.getElementById('st-result-winner');
    const subEl    = document.getElementById('st-result-sub');
    if (winnerEl) winnerEl.textContent = winner === 'tie' ? "IT'S A TIE!" : `${wName} WINS!`;
    if (subEl)    subEl.textContent    = `${p1name}: ${s1}/12 — ${p2name}: ${s2}/12`;

    const d1 = winner === 'player1' ? _ctx.MONEY_EVENTS.STACKER_WIN
             : winner === 'player2' ? _ctx.MONEY_EVENTS.STACKER_LOSE : _ctx.MONEY_EVENTS.STACKER_TIE;
    const d2 = winner === 'player2' ? _ctx.MONEY_EVENTS.STACKER_WIN
             : winner === 'player1' ? _ctx.MONEY_EVENTS.STACKER_LOSE : _ctx.MONEY_EVENTS.STACKER_TIE;

    function stSetDelta(id, val) {
      const el = document.getElementById(id); if (!el) return;
      el.textContent = `${val >= 0 ? '+' : ''}${Math.abs(val)} pts`;
      el.className   = `rmc-delta ${val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral'}`;
    }
    stSetDelta('st-delta-p1', d1);
    stSetDelta('st-delta-p2', d2);

    document.getElementById('btn-st-apply')     ?.classList.toggle('hidden',  stLocal.resultApplied);
    document.getElementById('btn-st-next-round')?.classList.toggle('hidden', !stLocal.resultApplied);
  }
}

// ── Render: player stacker ─────────────────────────────────
export function renderPlayerStacker(data) {
  if (!data || data.id !== 'stacker') return;

  const state  = data.state         ?? 'waiting';
  const scores = data.stackerScores ?? {};
  const levels = data.stackerLevels ?? {};

  document.getElementById('st-p-waiting')?.classList.toggle('hidden', state !== 'waiting');
  document.getElementById('st-p-active') ?.classList.toggle('hidden', state !== 'active');
  document.getElementById('st-p-ended')  ?.classList.toggle('hidden', state !== 'ended');

  // Tear down game instance when not active
  if (state !== 'active' && stGame) {
    stGame.destroy(); stGame = null; stGameStarted = false;
  }

  if (state === 'active') {
    // Opponent live level indicator
    const oppKey   = _ctx.playerKey === 'player1' ? 'player2' : 'player1';
    const oppScore = scores[oppKey];
    const oppLevel = levels[oppKey];
    const oppEl    = document.getElementById('st-p-opp-level');
    if (oppEl) oppEl.textContent = oppScore != null
      ? `${oppScore}/12 ✓`
      : (oppLevel != null ? String(oppLevel) : '—');

    // Launch game exactly once
    if (!stGameStarted) {
      stGameStarted = true;
      requestAnimationFrame(() => {
        const canvas = document.getElementById('st-canvas');
        if (!canvas || stGame) return;

        const w       = Math.min(340, window.innerWidth - 32);
        canvas.width  = w;
        canvas.height = Math.round(w * 1.44); // ~12 rows at w*0.12 each

        stGame = new Stacker(canvas, {
          onEnd: async (score, won) => {
            const instrEl = document.getElementById('st-p-instructions');
            if (instrEl) instrEl.textContent = won ? '⬆ PERFECT STACK! ⬆' : `GAME OVER — ${score}/12`;
            try {
              await _ctx.update(_ctx.ref(_ctx.db, 'round/stackerScores'), { [_ctx.playerKey]: score });
            } catch (err) { console.error('[Stacker] Score push error:', err); }
          },
          onLevel: async (level) => {
            const lvlEl = document.getElementById('st-p-level');
            if (lvlEl) lvlEl.textContent = level;
            try {
              await _ctx.update(_ctx.ref(_ctx.db, 'round/stackerLevels'), { [_ctx.playerKey]: level });
            } catch (err) { /* best-effort live update */ }
          },
        });
      });
    }
  }

  if (state === 'ended') {
    const winner  = data.winner;
    const myScore = scores[_ctx.playerKey] ?? 0;
    const ftEl    = document.getElementById('st-p-final-text');
    const fsEl    = document.getElementById('st-p-final-score');
    if (ftEl) {
      if (winner === _ctx.playerKey) {
        ftEl.textContent = 'YOU WIN! +25 pts'; ftEl.className = 'rb-player-result-text won';
      } else if (winner === 'tie') {
        ftEl.textContent = "IT'S A TIE! +5 pts"; ftEl.className = 'rb-player-result-text neutral';
      } else {
        ftEl.textContent = 'YOU LOSE. -15 pts'; ftEl.className = 'rb-player-result-text lost';
      }
    }
    if (fsEl) fsEl.textContent = `Your score: ${myScore} / 12`;
  }
}

// ── Host: auto-resolve when both scores arrive ─────────────
export async function resolveStacker(data) {
  const s1     = data.stackerScores?.player1 ?? 0;
  const s2     = data.stackerScores?.player2 ?? 0;
  const winner = s1 > s2 ? 'player1' : s2 > s1 ? 'player2' : 'tie';
  try {
    _ctx.flashTransition('var(--pink)', 500);
    await _ctx.update(_ctx.ref(_ctx.db, 'round'), { state: 'ended', winner });
  } catch (err) { console.error('[Stacker] Resolve error:', err); }
}

// ── Module init — called from main.js ─────────────────────
export function init(ctx) {
  _ctx = ctx;

  // HOST: START STACKER
  btnStStart = document.getElementById('btn-st-start');
  if (btnStStart) {
    btnStStart.addEventListener('click', async () => {
      btnStStart.disabled = true;
      // Reset stLocal by mutating (not reassigning) so imported reference in main.js stays valid
      stLocal.resolved      = false;
      stLocal.resultApplied = false;
      try {
        _ctx.flashTransition('var(--pink)', 500);
        await _ctx.set(_ctx.ref(_ctx.db, 'round'), {
          id:            'stacker',
          state:         'active',
          stackerScores: { player1: null, player2: null },
          stackerLevels: { player1: 0,    player2: 0    },
          winner:        null,
          answers: {}, timer: 0, question: '',
        });
      } catch (err) {
        console.error('[Stacker] Start error:', err);
        btnStStart.disabled = false;
      }
    });
  }

  // HOST: APPLY RESULTS
  const btnStApply = document.getElementById('btn-st-apply');
  if (btnStApply) {
    btnStApply.addEventListener('click', async () => {
      if (stLocal.resultApplied) return;
      btnStApply.disabled = true;
      stLocal.resultApplied = true;
      try {
        const [roundSnap, playersSnap] = await Promise.all([
          _ctx.get(_ctx.ref(_ctx.db, 'round')),
          _ctx.get(_ctx.ref(_ctx.db, 'players')),
        ]);
        const rd     = roundSnap.val();
        const pd     = playersSnap.val();
        const winner = rd?.winner;

        const d1 = winner === 'player1' ? _ctx.MONEY_EVENTS.STACKER_WIN
                 : winner === 'player2' ? _ctx.MONEY_EVENTS.STACKER_LOSE : _ctx.MONEY_EVENTS.STACKER_TIE;
        const d2 = winner === 'player2' ? _ctx.MONEY_EVENTS.STACKER_WIN
                 : winner === 'player1' ? _ctx.MONEY_EVENTS.STACKER_LOSE : _ctx.MONEY_EVENTS.STACKER_TIE;

        if (!pd?.player1 || !pd?.player2) throw new Error('Missing player data');
        const newB1 = Math.max(0, Math.round((pd.player1.points ?? 0) + d1));
        const newB2 = Math.max(0, Math.round((pd.player2.points ?? 0) + d2));

        _ctx.flashTransition('var(--green)', 700);
        await _ctx.update(_ctx.ref(_ctx.db, 'players'), {
          'player1/points': newB1, 'player1/alive': newB1 > 0,
          'player2/points': newB2, 'player2/alive': newB2 > 0,
        });
        btnStApply.classList.add('hidden');
        document.getElementById('btn-st-next-round')?.classList.remove('hidden');
      } catch (err) {
        console.error('[Stacker] Apply error:', err);
        stLocal.resultApplied = false;
        btnStApply.disabled = false;
      }
    });
  }

  // HOST: NEXT ROUND (4 → 5)
  const btnStNextRound = document.getElementById('btn-st-next-round');
  if (btnStNextRound) {
    btnStNextRound.addEventListener('click', async () => {
      btnStNextRound.disabled = true;
      try {
        await _ctx.roundWipeTransition('TAP BATTLE');
        await _ctx.update(_ctx.ref(_ctx.db, 'game'), { currentRound: 5 });
      } catch (err) {
        console.error('[Stacker] Next round error:', err);
        btnStNextRound.disabled = false;
      }
    });
  }
}
