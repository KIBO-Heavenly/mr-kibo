// ════════════════════════════════════════════════════════════
// ROUND 5 — TAP BATTLE
// ════════════════════════════════════════════════════════════

let _ctx;
let btnTbStart; // referenced in both init() and renderHostTapBattle()

const TB_DURATION_MS = 10000; // 10 seconds

let tbLocal = { resultApplied: false };
let _tbTimerInterval = null;

function tbStartClientTimer(endTime) {
  if (_tbTimerInterval) clearInterval(_tbTimerInterval);
  _tbTimerInterval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    const timerEl = document.getElementById('tb-p-timer');
    if (timerEl) timerEl.textContent = `${remaining}s`;
    if (remaining <= 0) { clearInterval(_tbTimerInterval); _tbTimerInterval = null; }
  }, 250);
}
function tbStopClientTimer() {
  if (_tbTimerInterval) { clearInterval(_tbTimerInterval); _tbTimerInterval = null; }
}

let _tbLocalCount = 0;   // local tap counter — avoids stale Firebase reads

// ── Host: render Tap Battle panel ───────────────────────────
export function renderHostTapBattle(data, playersData) {
  if (!data || data.id !== 'tapbattle') return;
  const preEl  = document.getElementById('tb-h-prestart');
  const actEl  = document.getElementById('tb-h-active');
  const endEl  = document.getElementById('tb-h-ended');
  if (!preEl) return;

  const state = data.state || 'waiting';
  preEl.classList.toggle('hidden', state !== 'waiting');
  actEl.classList.toggle('hidden', state !== 'active');
  endEl.classList.toggle('hidden', state !== 'ended');
  if (state === 'waiting' && btnTbStart) btnTbStart.disabled = false;

  if (state === 'active') {
    const taps = data.taps ?? {};
    const liveEl = document.getElementById('tb-h-live-counts');
    if (liveEl) {
      liveEl.innerHTML = _ctx.PLAYER_KEYS
        .filter(k => playersData?.[k]?.name)
        .map(k => `<div style="background:#1a1a1a;border:1px solid var(--pink);border-radius:12px;padding:10px 18px;font-family:var(--font-display);font-size:22px;color:var(--white)">
          <span style="color:var(--pink)">${playersData[k].name}</span> ${taps[k] ?? 0}
        </div>`)
        .join('');
    }
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil(((data.endTime ?? now) - now) / 1000));
    const timerEl = document.getElementById('tb-h-timer');
    if (timerEl) timerEl.textContent = `${remaining}s`;
  }

  if (state === 'ended') {
    const taps   = data.taps ?? {};
    const winner = data.winner;
    const winEl  = document.getElementById('tb-h-winner');
    const pd     = playersData?.[winner];
    if (winEl) winEl.textContent = winner ? `${pd?.name || winner} WINS!` : 'TIE!';

    const deltaEl = document.getElementById('tb-h-deltas');
    if (deltaEl) {
      let html = '';
      _ctx.PLAYER_KEYS.forEach(k => {
        const p = playersData?.[k];
        if (!p?.name) return;
        const isW = k === winner;
        const d   = isW ? _ctx.POINT_EVENTS.TAPBATTLE_WIN : _ctx.POINT_EVENTS.TAPBATTLE_LOSE;
        html += `<div style="color:${isW ? 'var(--green)' : 'var(--red)'}">${p.name}: ${d > 0 ? '+' : ''}${d} pts (${taps[k] ?? 0} taps)</div>`;
      });
      deltaEl.innerHTML = html;
    }

    const applyBtn = document.getElementById('btn-tb-apply');
    const nextBtn  = document.getElementById('btn-tb-next-round');
    if (applyBtn && !tbLocal.resultApplied) applyBtn.classList.remove('hidden');
    if (nextBtn  && tbLocal.resultApplied)  nextBtn.classList.remove('hidden');
  }
}

// ── Player: render Tap Battle panel ─────────────────────────
export function renderPlayerTapBattle(data) {
  if (!data || data.id !== 'tapbattle') return;
  const waitEl  = document.getElementById('tb-p-waiting');
  const actEl   = document.getElementById('tb-p-active');
  const endEl   = document.getElementById('tb-p-ended');
  if (!waitEl) return;

  const state = data.state || 'waiting';
  waitEl.classList.toggle('hidden', state !== 'waiting');
  actEl.classList.toggle('hidden',  state !== 'active');
  endEl.classList.toggle('hidden',  state !== 'ended');

  if (state === 'active') {
    const oppKey  = _ctx.playerKey === 'player1' ? 'player2' : 'player1';
    const serverTaps = data.taps?.[_ctx.playerKey] ?? 0;
    // Sync local counter if server has higher value (e.g. after reconnect)
    if (serverTaps > _tbLocalCount) _tbLocalCount = serverTaps;
    const oppTaps = data.taps?.[oppKey]    ?? 0;
    const endTime = data.endTime ?? (Date.now() + TB_DURATION_MS);
    const now     = Date.now();
    const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
    const timerEl  = document.getElementById('tb-p-timer');
    const countEl  = document.getElementById('tb-p-count');
    const oppEl    = document.getElementById('tb-p-opp-count');
    if (timerEl) timerEl.textContent = `${remaining}s`;
    if (countEl) countEl.textContent = _tbLocalCount;
    if (oppEl)   oppEl.textContent   = oppTaps;
    // Start smooth client-side countdown
    if (!_tbTimerInterval && endTime) tbStartClientTimer(endTime);
  }

  if (state !== 'active') {
    tbStopClientTimer();
    _tbLocalCount = 0; // reset for next round
  }

  if (state === 'ended') {
    const winner   = data.winner;
    const resultEl = document.getElementById('tb-p-result-text');
    if (resultEl) {
      resultEl.textContent = !winner ? "TIE!" : winner === _ctx.playerKey ? "YOU WIN! 🎉" : "YOU LOSE 😢";
      resultEl.style.color = !winner ? 'var(--pink)' : winner === _ctx.playerKey ? 'var(--green)' : 'var(--red)';
    }
  }
}

// ── Module init — called from main.js ─────────────────────
export function init(ctx) {
  _ctx = ctx;

  // HOST: START TAP BATTLE
  btnTbStart = document.getElementById('btn-tb-start');
  if (btnTbStart) {
    btnTbStart.addEventListener('click', async () => {
      btnTbStart.disabled = true;
      try {
        const endTime = Date.now() + TB_DURATION_MS;
        const tapsInit = {};
        _ctx.PLAYER_KEYS.forEach(k => { tapsInit[k] = 0; });
        await _ctx.set(_ctx.ref(_ctx.db, 'round'), {
          id: 'tapbattle', state: 'active',
          endTime, taps: tapsInit, winner: null,
        });
        // Auto-resolve after time + 500ms buffer
        setTimeout(async () => {
          try {
            const snap = await _ctx.get(_ctx.ref(_ctx.db, 'round'));
            const rd   = snap.val();
            if (!rd || rd.state !== 'active') return;
            const taps = rd.taps ?? {};
            let topKey = null, topVal = -1;
            let isTie  = false;
            _ctx.PLAYER_KEYS.forEach(k => {
              const v = taps[k] ?? 0;
              if (v > topVal) { topVal = v; topKey = k; isTie = false; }
              else if (v === topVal && topKey !== null) isTie = true;
            });
            await _ctx.update(_ctx.ref(_ctx.db, 'round'), { state: 'ended', winner: isTie ? null : topKey });
          } catch(e) { console.error('[TapBattle] auto-resolve error:', e); }
        }, TB_DURATION_MS + 500);
      } catch(e) {
        console.error('[TapBattle] start error:', e);
        btnTbStart.disabled = false;
      }
    });
  }

  // HOST: APPLY RESULTS
  const btnTbApply = document.getElementById('btn-tb-apply');
  if (btnTbApply) {
    btnTbApply.addEventListener('click', async () => {
      if (tbLocal.resultApplied) return;
      btnTbApply.disabled = true;
      tbLocal.resultApplied = true;
      try {
        const [roundSnap, playersSnap] = await Promise.all([
          _ctx.get(_ctx.ref(_ctx.db, 'round')), _ctx.get(_ctx.ref(_ctx.db, 'players')),
        ]);
        const rd = roundSnap.val();
        const pd = playersSnap.val();
        if (!rd || !pd) throw new Error('Missing data');
        const winner = rd.winner;
        const updates = {};
        _ctx.PLAYER_KEYS.forEach(k => {
          const p = pd[k];
          if (!p?.name) return;
          const d    = k === winner ? _ctx.POINT_EVENTS.TAPBATTLE_WIN : _ctx.POINT_EVENTS.TAPBATTLE_LOSE;
          const newP = Math.max(0, Math.round((p.points ?? 0) + d));
          updates[`${k}/points`] = newP;
          updates[`${k}/alive`]  = newP > 0;
        });
        _ctx.flashTransition('var(--green)', 700);
        await _ctx.update(_ctx.ref(_ctx.db, 'players'), updates);
        btnTbApply.classList.add('hidden');
        document.getElementById('btn-tb-next-round')?.classList.remove('hidden');
      } catch(e) {
        console.error('[TapBattle] apply error:', e);
        tbLocal.resultApplied = false;
        btnTbApply.disabled = false;
      }
    });
  }

  // HOST: NEXT ROUND (5 → 6)
  const btnTbNextRound = document.getElementById('btn-tb-next-round');
  if (btnTbNextRound) {
    btnTbNextRound.addEventListener('click', async () => {
      btnTbNextRound.disabled = true;
      try {
        await _ctx.roundWipeTransition('THE BETRAYAL VOTE');
        await _ctx.update(_ctx.ref(_ctx.db, 'game'), { currentRound: 6 });
      } catch(e) {
        console.error('[TapBattle] next round error:', e);
        btnTbNextRound.disabled = false;
      }
    });
  }

  // PLAYER: tap button
  let _tbLastTap = 0;
  const btnTbTap = document.getElementById('btn-tb-tap');
  if (btnTbTap && _ctx.view === 'player') {
    const handleTap = async () => {
      if (!_ctx.getLatestRoundData() || _ctx.getLatestRoundData().id !== 'tapbattle' || _ctx.getLatestRoundData().state !== 'active') return;
      if (!_ctx.playerKey) return;
      const now = Date.now();
      if (now - _tbLastTap < 80) return; // debounce 80ms
      _tbLastTap = now;
      _tbLocalCount++;
      const countEl = document.getElementById('tb-p-count');
      if (countEl) countEl.textContent = _tbLocalCount; // optimistic UI
      const tapCount = _tbLocalCount;
      try {
        await _ctx.update(_ctx.ref(_ctx.db, `round/taps`), { [_ctx.playerKey]: tapCount });
      } catch(e) { console.error('[TapBattle] tap error:', e); }
    };
    btnTbTap.addEventListener('touchstart', e => { e.preventDefault(); handleTap(); }, { passive: false });
    btnTbTap.addEventListener('click', handleTap);
  }
}
