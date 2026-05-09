// ════════════════════════════════════════════════════════════
// ROUND 2 — RED BUTTON (best of 7)
// ════════════════════════════════════════════════════════════

let _ctx;
let btnRbStart; // referenced in both init() and renderHostRedButton()

// Host-side ephemeral state
let rbLocal = { loop: null, waitingForClick: false, subRound: 0, resultApplied: false };

// Player-side: guard against double-click in the same button show
let rbPlayerClickedThisShow = false;

const RB_TOTAL = 7; // best of 7

// ── Spawn a floating "+1" animation at (x,y) ──────────────────
function spawnHitFloat(x, y) {
  const el = document.createElement('div');
  el.className = 'rb-hit-float';
  el.textContent = '+1';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// ── Show the MISSED! overlay briefly ──────────────────────────
function showMissed() {
  const el = document.getElementById('rb-missed-overlay');
  if (!el) return;
  el.classList.remove('show');
  void el.offsetWidth; // reflow to restart animation
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 950);
}

// ── Pop sound for button appear ───────────────────────────────
export function soundRbPop() {
  _ctx.playTone({ freq: 900, type: 'sine', gain: 0.55, duration: 0.06, attack: 0.005, decay: 0.055 });
  setTimeout(() => _ctx.playTone({ freq: 600, type: 'sine', gain: 0.25, duration: 0.06, attack: 0.005, decay: 0.055 }), 40);
}

// ── Ding sound for successful hit ────────────────────────────
function soundRbDing() {
  _ctx.playTone({ freq: 1319, type: 'sine', gain: 0.7, duration: 0.18, attack: 0.005, decay: 0.175 });
  setTimeout(() => _ctx.playTone({ freq: 1047, type: 'sine', gain: 0.4, duration: 0.14, attack: 0.005, decay: 0.135 }), 60);
}

// ── HOST: show the floating button at a random position ───────
async function rbShowButton() {
  if (rbLocal.waitingForClick) return;
  const left = (10 + Math.random() * 78).toFixed(1); // 10–88%
  const top  = (18 + Math.random() * 62).toFixed(1); // 18–80%
  rbPlayerClickedThisShow = false;

  try {
    await _ctx.update(_ctx.ref(_ctx.db, 'round'), {
      btnVisible:  true,
      btnLeft:     parseFloat(left),
      btnTop:      parseFloat(top),
      btnShowTime: Date.now(),
      'clicks/player1': null,
      'clicks/player2': null,
    });
    rbLocal.waitingForClick = true; // Set AFTER write so stale listeners can't trigger false win
  } catch (err) { console.error('[RB] show error', err); return; }

  // Auto-hide after 3 s if no one clicks
  rbLocal.loop = setTimeout(() => rbResolvePoint(null), 3000);
}

// ── HOST: resolve a point (winner = playerKey or null = missed) ─
async function rbResolvePoint(winner) {
  if (!rbLocal.waitingForClick) return;
  rbLocal.waitingForClick = false;
  clearTimeout(rbLocal.loop);
  rbLocal.loop = null;

  rbLocal.subRound++;
  const prevScores = _ctx.getLatestRoundData()?.scores ?? { player1: 0, player2: 0 };
  const scores = { player1: prevScores.player1 ?? 0, player2: prevScores.player2 ?? 0 };
  if (winner) scores[winner] = (scores[winner] ?? 0) + 1;

  const isDone = rbLocal.subRound >= RB_TOTAL;

  try {
    if (isDone) {
      const s1 = scores.player1, s2 = scores.player2;
      const roundWinner = s1 > s2 ? 'player1' : s2 > s1 ? 'player2' : 'tie';
      await _ctx.update(_ctx.ref(_ctx.db, 'round'), {
        btnVisible:      false,
        subRound:        rbLocal.subRound,
        scores,
        lastPointWinner: winner,
        state:           'ended',
        winner:          roundWinner,
      });
    } else {
      await _ctx.update(_ctx.ref(_ctx.db, 'round'), {
        btnVisible:      false,
        subRound:        rbLocal.subRound,
        scores,
        lastPointWinner: winner,
      });
      // Wait 1–4 s then show again
      const delay = 1000 + Math.random() * 3000;
      rbLocal.loop = setTimeout(rbShowButton, delay);
    }
  } catch (err) { console.error('[RB] resolve error', err); }
}

// ── Render: host Red Button ────────────────────────────────────
export function renderHostRedButton(data, playersData) {
  if (!data || data.id !== 'redbutton') return;

  const state    = data.state    ?? 'waiting';
  const subRound = data.subRound ?? 0;
  const scores   = data.scores   ?? { player1: 0, player2: 0 };
  const p1name   = playersData?.player1?.name || 'Player 1';
  const p2name   = playersData?.player2?.name || 'Player 2';

  // Names
  ['rb-sn1','rb-rmc-name-p1'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = p1name; });
  ['rb-sn2','rb-rmc-name-p2'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = p2name; });

  // Scores + sub tracker
  const s1El = document.getElementById('rb-s1'); if (s1El) s1El.textContent = scores.player1 ?? 0;
  const s2El = document.getElementById('rb-s2'); if (s2El) s2El.textContent = scores.player2 ?? 0;
  const subEl = document.getElementById('rb-sub-num'); if (subEl) subEl.textContent = subRound;

  // Section visibility
  document.getElementById('rb-prestart')    ?.classList.toggle('hidden', state !== 'waiting');
  document.getElementById('rb-active-view') ?.classList.toggle('hidden', state !== 'active');
  document.getElementById('rb-ended-view')  ?.classList.toggle('hidden', state !== 'ended');
  if (state === 'waiting' && btnRbStart) btnRbStart.disabled = false;

  if (state === 'active') {
    const lpw = data.lastPointWinner;
    const lpEl = document.getElementById('rb-last-point');
    if (lpEl) {
      if (lpw === null || lpw === undefined) {
        lpEl.textContent = '';
      } else if (lpw === null) {
        lpEl.textContent = 'MISSED — no point';
      } else {
        const wname = lpw === 'player1' ? p1name : p2name;
        lpEl.textContent = `Last point → ${wname}`;
        lpEl.style.color = 'var(--green)';
      }
    }

    // If host's listener sees a click come in while waitingForClick → resolve immediately
    // Guard: only accept clicks that happened AFTER btnShowTime to prevent stale-click false wins
    if (rbLocal.waitingForClick) {
      const clicks      = data.clicks ?? {};
      const btnShowTime = data.btnShowTime ?? 0;
      let t1 = clicks.player1 ?? null;
      let t2 = clicks.player2 ?? null;
      // Discard any click that predates this button show (leftover from previous sub-round)
      if (t1 !== null && t1 < btnShowTime) t1 = null;
      if (t2 !== null && t2 < btnShowTime) t2 = null;
      if (t1 !== null || t2 !== null) {
        let winner;
        if (t1 !== null && t2 !== null) winner = t1 <= t2 ? 'player1' : 'player2';
        else winner = t1 !== null ? 'player1' : 'player2';
        rbResolvePoint(winner);
      }
    }
  }

  if (state === 'ended') {
    const s1 = scores.player1 ?? 0, s2 = scores.player2 ?? 0;
    const winner     = data.winner;
    const winnerName = winner === 'player1' ? p1name : winner === 'player2' ? p2name : null;

    const fwEl = document.getElementById('rb-final-winner');
    const fsEl = document.getElementById('rb-final-sub');
    if (fwEl) fwEl.textContent = winner === 'tie' ? "IT'S A TIE!" : `${winnerName} WINS!`;
    if (fsEl) fsEl.textContent = `${s1} – ${s2} points`;

    // Net money
    const d1 = s1 * _ctx.MONEY_EVENTS.REDBUTTON_WIN + s2 * _ctx.MONEY_EVENTS.REDBUTTON_LOSE;
    const d2 = s2 * _ctx.MONEY_EVENTS.REDBUTTON_WIN + s1 * _ctx.MONEY_EVENTS.REDBUTTON_LOSE;
    function setDelta(id, val) {
      const el = document.getElementById(id); if (!el) return;
      el.textContent = `${val >= 0 ? '+' : ''}${Math.abs(val)} pts`;
      el.className   = `rmc-delta ${val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral'}`;
    }
    setDelta('rb-delta-p1', d1);
    setDelta('rb-delta-p2', d2);

    const applyBtn = document.getElementById('btn-rb-apply');
    if (applyBtn) applyBtn.classList.toggle('hidden', rbLocal.resultApplied);
  }
}

// ── Render: player Red Button ──────────────────────────────────
export function renderPlayerRedButton(data) {
  if (!data || data.id !== 'redbutton') return;

  const state    = data.state   ?? 'waiting';
  const scores   = data.scores  ?? { player1: 0, player2: 0 };
  const myScore  = (_ctx.playerKey === 'player1' ? scores.player1 : scores.player2) ?? 0;
  const oppScore = (_ctx.playerKey === 'player1' ? scores.player2 : scores.player1) ?? 0;
  const subRound = data.subRound ?? 0;

  ['rb-p-waiting','rb-p-active','rb-p-ended'].forEach(id => document.getElementById(id)?.classList.add('hidden'));

  if (state === 'waiting') {
    document.getElementById('rb-p-waiting')?.classList.remove('hidden');
    return;
  }

  // Hide fixed button by default; show/position if visible
  const smallBtn = document.getElementById('rb-small-btn');
  if (smallBtn) {
    if (data.btnVisible && state === 'active') {
      smallBtn.style.left    = data.btnLeft + '%';
      smallBtn.style.top     = data.btnTop  + '%';
      if (smallBtn.style.display === 'none' || !smallBtn.style.display) {
        smallBtn.style.display = 'block';
        smallBtn.style.animation = 'none';
        void smallBtn.offsetWidth; // force reflow to restart animation
        smallBtn.style.animation = 'rb-pop-in 1.1s cubic-bezier(0.34,1.56,0.64,1) both';
        setTimeout(() => {
          if (smallBtn.style.display !== 'none') {
            smallBtn.style.animation = 'rb-small-pulse 0.45s ease-in-out infinite';
          }
        }, 1100);
      }
    } else {
      if (smallBtn.style.display !== 'none') {
        // Button just disappeared — show MISSED if player didn't click
        if (!rbPlayerClickedThisShow) showMissed();
      }
      smallBtn.style.display = 'none';
      rbPlayerClickedThisShow = false;
    }
  }

  if (state === 'active') {
    document.getElementById('rb-p-active')?.classList.remove('hidden');
    const myScoreEl  = document.getElementById('rb-p-my-score');  if (myScoreEl)  myScoreEl.textContent  = myScore;
    const oppScoreEl = document.getElementById('rb-p-opp-score'); if (oppScoreEl) oppScoreEl.textContent = oppScore;
    const subEl      = document.getElementById('rb-p-sub-num');   if (subEl)      subEl.textContent      = subRound;

    const statusEl = document.getElementById('rb-p-status-text');
    if (statusEl) {
      statusEl.textContent = data.btnVisible ? 'CLICK IT!' : 'WATCH CAREFULLY…';
      statusEl.style.color = data.btnVisible ? 'var(--red)' : 'var(--pink)';
    }
  } else if (state === 'ended') {
    // Hide button
    if (smallBtn) smallBtn.style.display = 'none';
    document.getElementById('rb-p-ended')?.classList.remove('hidden');
    const winner = data.winner;
    const ftEl   = document.getElementById('rb-p-final-text');
    if (ftEl) {
      if (winner === _ctx.playerKey) {
        ftEl.textContent = 'YOU WIN THE ROUND!'; ftEl.className = 'rb-player-result-text won';
      } else if (winner === 'tie') {
        ftEl.textContent = "IT'S A TIE!"; ftEl.className = 'rb-player-result-text neutral';
      } else {
        ftEl.textContent = 'YOU LOSE THE ROUND'; ftEl.className = 'rb-player-result-text lost';
      }
    }
  }
}

// ── Module init — called from main.js ─────────────────────
export function init(ctx) {
  _ctx = ctx;

  // HOST: START RED BUTTON
  btnRbStart = document.getElementById('btn-rb-start');
  if (btnRbStart) {
    btnRbStart.addEventListener('click', async () => {
      btnRbStart.disabled = true;
      rbLocal = { loop: null, waitingForClick: false, subRound: 0, resultApplied: false };
      try {
        _ctx.flashTransition('var(--red)', 500);
        await _ctx.set(_ctx.ref(_ctx.db, 'round'), {
          id: 'redbutton', state: 'active',
          subRound: 0, btnVisible: false, btnLeft: 50, btnTop: 50, btnShowTime: null,
          clicks: { player1: null, player2: null }, lastPointWinner: null,
          scores: { player1: 0, player2: 0 }, winner: null,
          answers: {}, stackerScores: {}, timer: 0, question: '',
        });
        // Kick off the loop — short initial delay
        rbLocal.loop = setTimeout(rbShowButton, 1200 + Math.random() * 1800);
      } catch (err) {
        console.error('[RedButton] Start error:', err);
        btnRbStart.disabled = false;
      }
    });
  }

  // HOST: FORCE END ROUND
  const btnRbForceEnd = document.getElementById('btn-rb-force-end');
  if (btnRbForceEnd) {
    btnRbForceEnd.addEventListener('click', async () => {
      btnRbForceEnd.disabled = true;
      clearTimeout(rbLocal.loop);
      rbLocal.loop = null;
      rbLocal.waitingForClick = false;
      const scores  = _ctx.getLatestRoundData()?.scores ?? { player1: 0, player2: 0 };
      const s1 = scores.player1 ?? 0, s2 = scores.player2 ?? 0;
      const winner = s1 > s2 ? 'player1' : s2 > s1 ? 'player2' : 'tie';
      try {
        await _ctx.update(_ctx.ref(_ctx.db, 'round'), { btnVisible: false, state: 'ended', winner });
      } catch (err) { console.error('[RedButton] Force end error:', err); btnRbForceEnd.disabled = false; }
    });
  }

  // HOST: APPLY RESULTS
  const btnRbApply = document.getElementById('btn-rb-apply');
  if (btnRbApply) {
    btnRbApply.addEventListener('click', async () => {
      if (rbLocal.resultApplied) return;
      btnRbApply.disabled = true;
      rbLocal.resultApplied = true;
      try {
        const [roundSnap, playersSnap] = await Promise.all([
          _ctx.get(_ctx.ref(_ctx.db, 'round')),
          _ctx.get(_ctx.ref(_ctx.db, 'players')),
        ]);
        const rd  = roundSnap.val();
        const pd  = playersSnap.val();
        const scores = rd?.scores ?? { player1: 0, player2: 0 };
        const s1 = scores.player1 ?? 0, s2 = scores.player2 ?? 0;

        const d1 = s1 * _ctx.MONEY_EVENTS.REDBUTTON_WIN + s2 * _ctx.MONEY_EVENTS.REDBUTTON_LOSE;
        const d2 = s2 * _ctx.MONEY_EVENTS.REDBUTTON_WIN + s1 * _ctx.MONEY_EVENTS.REDBUTTON_LOSE;

        if (!pd?.player1 || !pd?.player2) throw new Error('Missing player data');
        const newB1 = Math.max(0, Math.round((pd.player1.points ?? 0) + d1));
        const newB2 = Math.max(0, Math.round((pd.player2.points ?? 0) + d2));

        _ctx.flashTransition('var(--green)', 700);
        await _ctx.update(_ctx.ref(_ctx.db, 'players'), {
          'player1/points': newB1, 'player1/alive': newB1 > 0,
          'player2/points': newB2, 'player2/alive': newB2 > 0,
        });
        btnRbApply.classList.add('hidden');
      } catch (err) {
        console.error('[RedButton] Apply error:', err);
        rbLocal.resultApplied = false;
        btnRbApply.disabled = false;
      }
    });

    // Also show NEXT ROUND button after apply fires
    btnRbApply.addEventListener('click', () => {
      setTimeout(() => document.getElementById('btn-rb-next-round')?.classList.remove('hidden'), 1800);
    });
  }

  // HOST: NEXT ROUND (2 → 3)
  const btnRbNextRound = document.getElementById('btn-rb-next-round');
  if (btnRbNextRound) {
    btnRbNextRound.addEventListener('click', async () => {
      btnRbNextRound.disabled = true;
      try {
        await _ctx.roundWipeTransition('ROUND 3');
        await _ctx.update(_ctx.ref(_ctx.db, 'game'), { currentRound: 3 });
      } catch (err) {
        console.error('[RedButton] Next round error:', err);
        btnRbNextRound.disabled = false;
      }
    });
  }

  // PLAYER: click the floating red button
  const rbSmallBtn = document.getElementById('rb-small-btn');
  if (rbSmallBtn) {
    rbSmallBtn.addEventListener('click', async (e) => {
      if (_ctx.view !== 'player') return;
      if (rbPlayerClickedThisShow) return;
      const data = _ctx.getLatestRoundData();
      if (!data || data.id !== 'redbutton' || !data.btnVisible) return;
      // Existence check: only write if we haven't already registered a click this show
      const clicks = data.clicks ?? {};
      if (clicks[_ctx.playerKey] != null) return;
      rbPlayerClickedThisShow = true;

      soundRbDing();
      spawnHitFloat(e.clientX, e.clientY);

      try {
        await _ctx.update(_ctx.ref(_ctx.db, 'round/clicks'), { [_ctx.playerKey]: Date.now() });
      } catch (err) { console.error('[RedButton] Click write error:', err); }
    });
  }
}
