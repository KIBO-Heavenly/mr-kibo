// ════════════════════════════════════════════════════════════
// ROUND 8 — HOT POTATO
// ════════════════════════════════════════════════════════════

let _ctx;

// ── Host-side ephemeral state ─────────────────────────────
let hpLocal = { resultApplied: false, pollInterval: null, tickInterval: null, bombStart: null, bombTime: null, endedSoundPlayed: false };

// ── Player-side hold tracking (for glow intensity) ────────
let _hpHoldStart         = null;
let _hpIntensityInterval = null;
let _hpPlayerEndedFired  = false;

// ── Start the host polling + tick loop ────────────────────
function hpStartPollLoop(bombTime) {
  hpLocal.bombTime  = bombTime;
  hpLocal.bombStart = hpLocal.bombStart ?? (bombTime - 30000);

  if (hpLocal.tickInterval) clearInterval(hpLocal.tickInterval);
  let _hpLastTick = 0;
  hpLocal.tickInterval = setInterval(() => {
    const data = _ctx.getLatestRoundData();
    if (!data || data.id !== 'hotpotato' || data.state !== 'active') {
      clearInterval(hpLocal.tickInterval); hpLocal.tickInterval = null; return;
    }
    const totalDuration = hpLocal.bombTime - hpLocal.bombStart;
    const progress      = Math.min(1, (Date.now() - hpLocal.bombStart) / totalDuration);

    const fillEl = document.getElementById('hp-h-timer-fill');
    if (fillEl) {
      const pct = Math.max(0, (1 - progress) * 100);
      fillEl.style.width = pct + '%';
      fillEl.classList.toggle('danger', pct < 30);
    }

    const msPerTick = Math.max(180, 1500 - progress * 1320);
    if (Date.now() - _hpLastTick >= msPerTick) {
      _hpLastTick = Date.now();
      _ctx.playTone({ freq: 760 + progress * 680, type: 'square', gain: 0.16, duration: 0.04, attack: 0.001, decay: 0.034 });
    }
  }, 80);

  if (hpLocal.pollInterval) clearInterval(hpLocal.pollInterval);
  hpLocal.pollInterval = setInterval(async () => {
    const data = _ctx.getLatestRoundData();
    if (!data || data.id !== 'hotpotato' || data.state !== 'active') {
      clearInterval(hpLocal.pollInterval); hpLocal.pollInterval = null; return;
    }
    if (data.bombTime && Date.now() >= data.bombTime) {
      clearInterval(hpLocal.pollInterval); hpLocal.pollInterval = null;
      clearInterval(hpLocal.tickInterval); hpLocal.tickInterval = null;
      const loser  = data.holder ?? 'player1';
      const winner = loser === 'player1' ? 'player2' : 'player1';
      try {
        _ctx.soundElimination();
        _ctx.flashTransition('var(--red)', 700);
        await _ctx.update(_ctx.ref(_ctx.db, 'round'), { state: 'ended', loser, winner });
      } catch (e) { console.error('[HotPotato] Bomb explode error:', e); }
    }
  }, 1000);
}

function hpStopPollLoop() {
  if (hpLocal.pollInterval) { clearInterval(hpLocal.pollInterval); hpLocal.pollInterval = null; }
  if (hpLocal.tickInterval) { clearInterval(hpLocal.tickInterval); hpLocal.tickInterval = null; }
}

// ── HOST: render hot potato panel ────────────────────────
export function renderHostHotPotato(data, playersData) {
  if (!data || data.id !== 'hotpotato') return;
  const state     = data.state    ?? 'waiting';
  const holder    = data.holder   ?? 'player1';
  const passCount = data.passCount ?? 0;
  const p1name    = playersData?.player1?.name || 'Player 1';
  const p2name    = playersData?.player2?.name || 'Player 2';

  const rn1 = document.getElementById('hp-rmc-name-p1');
  const rn2 = document.getElementById('hp-rmc-name-p2');
  if (rn1) rn1.textContent = p1name;
  if (rn2) rn2.textContent = p2name;

  document.getElementById('hp-h-prestart')?.classList.toggle('hidden', state !== 'waiting');
  document.getElementById('hp-h-active')  ?.classList.toggle('hidden', state !== 'active');
  document.getElementById('hp-h-ended')   ?.classList.toggle('hidden', state !== 'ended');

  if (state === 'active') {
    const countEl  = document.getElementById('hp-h-pass-count');
    const holderEl = document.getElementById('hp-h-holder-text');
    if (countEl)  countEl.textContent  = passCount;
    if (holderEl) holderEl.textContent = `🥔 ${holder === 'player1' ? p1name : p2name} is holding`;
    if (!hpLocal.pollInterval && data.bombTime) hpStartPollLoop(data.bombTime);
  }

  if (state !== 'active') hpStopPollLoop();

  if (state === 'ended') {
    const winner  = data.winner ?? 'player1';
    const loser   = data.loser  ?? 'player2';
    const wName   = winner === 'player1' ? p1name : p2name;
    const lName   = loser  === 'player1' ? p1name : p2name;

    const winnerEl = document.getElementById('hp-h-winner');
    const subEl    = document.getElementById('hp-h-sub');
    if (winnerEl) winnerEl.textContent = `🎉 ${wName} WINS!`;
    if (subEl)    subEl.textContent    = `${lName} was holding the potato when it exploded! ${passCount} total pass${passCount === 1 ? '' : 'es'}.`;

    function hpSetDelta(id, val) {
      const el = document.getElementById(id); if (!el) return;
      el.textContent = `${val >= 0 ? '+' : ''}${Math.abs(val)} pts`;
      el.className   = `rmc-delta ${val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral'}`;
    }
    hpSetDelta('hp-delta-p1', winner === 'player1' ? _ctx.POINT_EVENTS.HOTPOTATO_WIN : _ctx.POINT_EVENTS.HOTPOTATO_LOSE);
    hpSetDelta('hp-delta-p2', winner === 'player2' ? _ctx.POINT_EVENTS.HOTPOTATO_WIN : _ctx.POINT_EVENTS.HOTPOTATO_LOSE);

    document.getElementById('btn-hp-apply')     ?.classList.toggle('hidden',  hpLocal.resultApplied);
    document.getElementById('btn-hp-next-round')?.classList.toggle('hidden', !hpLocal.resultApplied);

    if (!hpLocal.endedSoundPlayed) {
      hpLocal.endedSoundPlayed = true;
      _ctx.soundFanfare();
    }
  }
}

// ── PLAYER: render hot potato panel ──────────────────────
export function renderPlayerHotPotato(data) {
  if (!data || data.id !== 'hotpotato') return;
  const state     = data.state    ?? 'waiting';
  const holder    = data.holder   ?? 'player1';
  const passCount = data.passCount ?? 0;
  const amHolding = holder === _ctx.playerKey;

  document.getElementById('hp-p-waiting')?.classList.toggle('hidden', state !== 'waiting');
  document.getElementById('hp-p-active') ?.classList.toggle('hidden', state !== 'active');
  document.getElementById('hp-p-ended')  ?.classList.toggle('hidden', state !== 'ended');

  if (state === 'active') {
    const countEl = document.getElementById('hp-p-pass-count');
    if (countEl) countEl.textContent = passCount;

    document.getElementById('hp-p-holding')    ?.classList.toggle('hidden', !amHolding);
    document.getElementById('hp-p-not-holding')?.classList.toggle('hidden',  amHolding);

    const passBtn = document.getElementById('btn-hp-pass');
    if (passBtn && amHolding) {
      if (!_hpHoldStart) {
        _hpHoldStart = Date.now();
        if (_hpIntensityInterval) clearInterval(_hpIntensityInterval);
        _hpIntensityInterval = setInterval(() => {
          const pb   = document.getElementById('btn-hp-pass');
          const held = Date.now() - (_hpHoldStart ?? Date.now());
          if (!pb) return;
          pb.classList.remove('hp-hot', 'hp-critical');
          if      (held > 8000) pb.classList.add('hp-critical');
          else if (held > 3500) pb.classList.add('hp-hot');
        }, 400);
      }
    } else {
      _hpHoldStart = null;
      if (_hpIntensityInterval) { clearInterval(_hpIntensityInterval); _hpIntensityInterval = null; }
      if (passBtn) passBtn.classList.remove('hp-hot', 'hp-critical');
    }
  } else {
    _hpHoldStart = null;
    if (_hpIntensityInterval) { clearInterval(_hpIntensityInterval); _hpIntensityInterval = null; }
  }

  if (state === 'ended') {
    const winner = data.winner;
    const ftEl   = document.getElementById('hp-p-result-text');
    if (ftEl && !_hpPlayerEndedFired) {
      _hpPlayerEndedFired = true;
      if (winner === _ctx.playerKey) {
        ftEl.textContent = 'YOU WIN! 🎉 +20 pts';
        ftEl.className   = 'rb-player-result-text won';
        _ctx.soundFanfare();
      } else {
        ftEl.textContent = 'YOU LOSE 💀 −20 pts';
        ftEl.className   = 'rb-player-result-text lost';
        _ctx.soundElimination();
      }
    }
  } else {
    _hpPlayerEndedFired = false;
  }
}

// ── init(ctx): wire all button event listeners ────────────
export function init(ctx) {
  _ctx = ctx;

  // HOST: wire START button
  if (_ctx.view === 'host') {
    const btnHpStart = document.getElementById('btn-hp-start');
    if (btnHpStart) {
      btnHpStart.addEventListener('click', async () => {
        btnHpStart.disabled = true;
        hpStopPollLoop();
        hpLocal = { resultApplied: false, pollInterval: null, tickInterval: null, bombStart: null, bombTime: null, endedSoundPlayed: false };

        const duration    = (15 + Math.floor(Math.random() * 26)) * 1000;
        const bombTime    = Date.now() + duration;
        hpLocal.bombStart = Date.now();
        try {
          _ctx.flashTransition('var(--red)', 350);
          await _ctx.roundWipeTransition('HOT POTATO');
          await _ctx.set(_ctx.ref(_ctx.db, 'round'), {
            id:        'hotpotato',
            state:     'active',
            holder:    'player1',
            bombTime,
            passCount: 0,
            loser:     null,
            winner:    null,
          });
          hpStartPollLoop(bombTime);
        } catch (err) {
          console.error('[HotPotato] Start error:', err);
          btnHpStart.disabled = false;
        }
      });
    }

    // HOST: wire APPLY button
    const btnHpApply = document.getElementById('btn-hp-apply');
    if (btnHpApply) {
      btnHpApply.addEventListener('click', async () => {
        if (hpLocal.resultApplied) return;
        btnHpApply.disabled   = true;
        hpLocal.resultApplied = true;
        try {
          const [roundSnap, playersSnap] = await Promise.all([
            _ctx.get(_ctx.ref(_ctx.db, 'round')), _ctx.get(_ctx.ref(_ctx.db, 'players')),
          ]);
          const rd     = roundSnap.val();
          const pd     = playersSnap.val();
          const winner = rd?.winner;
          const loser  = rd?.loser;
          if (!winner || !loser) throw new Error('Missing winner/loser');
          const newB1 = Math.max(0, Math.round(
            (pd?.player1?.points ?? 0) + (winner === 'player1' ? _ctx.POINT_EVENTS.HOTPOTATO_WIN : _ctx.POINT_EVENTS.HOTPOTATO_LOSE)
          ));
          const newB2 = Math.max(0, Math.round(
            (pd?.player2?.points ?? 0) + (winner === 'player2' ? _ctx.POINT_EVENTS.HOTPOTATO_WIN : _ctx.POINT_EVENTS.HOTPOTATO_LOSE)
          ));
          _ctx.flashTransition('var(--green)', 600);
          await _ctx.update(_ctx.ref(_ctx.db, 'players'), {
            'player1/points': newB1, 'player1/alive': newB1 > 0,
            'player2/points': newB2, 'player2/alive': newB2 > 0,
          });
          btnHpApply.classList.add('hidden');
          document.getElementById('btn-hp-next-round')?.classList.remove('hidden');
        } catch (err) {
          console.error('[HotPotato] Apply error:', err);
          hpLocal.resultApplied = false;
          btnHpApply.disabled   = false;
        }
      });
    }

    // HOST: wire NEXT ROUND button (Hot Potato → Finale)
    const btnHpNextRound = document.getElementById('btn-hp-next-round');
    if (btnHpNextRound) {
      btnHpNextRound.addEventListener('click', async () => {
        btnHpNextRound.disabled = true;
        try {
          _ctx.flashTransition('#FF69B4', 600);
          await _ctx.update(_ctx.ref(_ctx.db, 'game'), { phase: 'finale' });
        } catch (err) {
          console.error('[HotPotato] Next round error:', err);
          btnHpNextRound.disabled = false;
        }
      });
    }
  }

  // PLAYER: wire PASS button
  if (_ctx.view === 'player') {
    const btnHpPass = document.getElementById('btn-hp-pass');
    if (btnHpPass) {
      const handleHpPass = async (e) => {
        if (e?.type === 'touchstart') e.preventDefault();
        const data = _ctx.getLatestRoundData();
        if (!data || data.id !== 'hotpotato' || data.state !== 'active') return;
        if (data.holder !== _ctx.playerKey) return;
        const newHolder = _ctx.playerKey === 'player1' ? 'player2' : 'player1';
        const newCount  = (data.passCount ?? 0) + 1;
        _ctx.soundClick();
        try {
          await _ctx.update(_ctx.ref(_ctx.db, 'round'), { holder: newHolder, passCount: newCount });
        } catch (e) { console.error('[HotPotato] Pass error:', e); }
      };
      btnHpPass.addEventListener('touchstart', handleHpPass, { passive: false });
      btnHpPass.addEventListener('click',      handleHpPass);
    }
  }
}
