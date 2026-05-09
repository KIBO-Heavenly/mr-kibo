// ════════════════════════════════════════════════════════════
// ROUND 6 — THE BETRAYAL VOTE (prisoner's dilemma)
// ════════════════════════════════════════════════════════════

let _ctx;
let btnBtStart; // referenced in both init() and renderHostBetrayal()

// Ephemeral state
let btLocal               = { resultApplied: false };
let btCountdownInterval   = null;
let btCountdownStarted    = false;
let btHostRevealScheduled = false;

// Outcome matrix — built in init() once _ctx is available
let betrayalOutcomes = null;

function getOutcomeKey(v1, v2) {
  if (v1 === 'cooperate' && v2 === 'cooperate') return 'both_cooperate';
  if (v1 === 'betray'    && v2 === 'cooperate') return 'p1_betrays';
  if (v1 === 'cooperate' && v2 === 'betray')    return 'p2_betrays';
  return 'both_betray';
}

function btStartCountdown(revealTime, elementId) {
  if (btCountdownStarted) return;
  btCountdownStarted = true;
  if (btCountdownInterval) { clearInterval(btCountdownInterval); btCountdownInterval = null; }
  const el = document.getElementById(elementId);
  function tick() {
    const remaining = Math.ceil((revealTime - Date.now()) / 1000);
    if (el) el.textContent = Math.max(0, remaining);
    if (remaining <= 0) { clearInterval(btCountdownInterval); btCountdownInterval = null; }
  }
  tick();
  btCountdownInterval = setInterval(tick, 250);
}

function btStopCountdown() {
  btCountdownStarted = false;
  if (btCountdownInterval) { clearInterval(btCountdownInterval); btCountdownInterval = null; }
}

// ── Render: host betrayal ──────────────────────────────────
export function renderHostBetrayal(data, playersData) {
  if (!data || data.id !== 'betrayal') return;

  const state  = data.state  ?? 'waiting';
  const votes  = data.votes  ?? {};
  const p1name = playersData?.player1?.name || 'Player 1';
  const p2name = playersData?.player2?.name || 'Player 2';

  // Names
  ['bt-host-p1-name','bt-rmc-name-p1'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = p1name; });
  ['bt-host-p2-name','bt-rmc-name-p2'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = p2name; });

  if (state !== 'revealing') btStopCountdown();

  // Section visibility
  document.getElementById('bt-prestart') ?.classList.toggle('hidden', state !== 'waiting');
  document.getElementById('bt-active')   ?.classList.toggle('hidden', state !== 'active');
  document.getElementById('bt-revealing')?.classList.toggle('hidden', state !== 'revealing');
  document.getElementById('bt-revealed') ?.classList.toggle('hidden', state !== 'revealed' && state !== 'ended');
  if (state === 'waiting' && btnBtStart) btnBtStart.disabled = false;

  if (state === 'active') {
    btHostRevealScheduled = false;
    const v1 = votes.player1, v2 = votes.player2;
    const bothVoted = v1 != null && v2 != null;

    [['bt-host-p1-vote','bt-host-p1-card', v1],
     ['bt-host-p2-vote','bt-host-p2-card', v2]].forEach(([voteId, cardId, v]) => {
      const voteEl = document.getElementById(voteId);
      const cardEl = document.getElementById(cardId);
      if (v) {
        if (voteEl) { voteEl.textContent = v === 'cooperate' ? '🤝 COOPERATE' : '🔪 BETRAY'; voteEl.style.color = v === 'cooperate' ? 'var(--green)' : 'var(--red)'; }
        cardEl?.classList.add('bt-voted');
      } else {
        if (voteEl) { voteEl.textContent = '⋯ Waiting…'; voteEl.style.color = '#444'; }
        cardEl?.classList.remove('bt-voted');
      }
    });

    const revealBtn = document.getElementById('btn-bt-reveal');
    if (revealBtn) revealBtn.disabled = !bothVoted;
  }

  if (state === 'revealing') {
    const revealTime = data.revealTime ?? (Date.now() + 5000);
    btStartCountdown(revealTime, 'bt-host-countdown');
    if (!btHostRevealScheduled) {
      btHostRevealScheduled = true;
      const delay = Math.max(0, revealTime - Date.now());
      setTimeout(async () => {
        try {
          const v = _ctx.getLatestRoundData()?.votes ?? {};
          const outcomeKey = getOutcomeKey(v.player1, v.player2);
          _ctx.flashTransition('var(--white)', 700);
          await _ctx.update(_ctx.ref(_ctx.db, 'round'), { state: 'revealed', outcome: outcomeKey });
        } catch (err) { console.error('[Betrayal] Reveal write error:', err); }
      }, delay);
    }
  }

  if (state === 'revealed' || state === 'ended') {
    const v1 = votes.player1, v2 = votes.player2;
    const outcomeKey = data.outcome ?? getOutcomeKey(v1, v2);
    const outcome    = betrayalOutcomes?.[outcomeKey] ?? { p1: 0, p2: 0 };

    const headlineEl = document.getElementById('bt-result-headline');
    if (headlineEl) {
      if      (outcomeKey === 'both_cooperate') headlineEl.textContent = '🤝 BOTH COOPERATED!';
      else if (outcomeKey === 'both_betray')    headlineEl.textContent = '🔪 BOTH BETRAYED!';
      else if (outcomeKey === 'p1_betrays')     headlineEl.textContent = `${p1name} BETRAYED!`;
      else                                      headlineEl.textContent = `${p2name} BETRAYED!`;
    }

    const gridEl = document.getElementById('bt-reveal-grid');
    if (gridEl && v1 && v2) {
      const v1cls = v1 === 'cooperate' ? 'bt-cooperate' : 'bt-betray';
      const v2cls = v2 === 'cooperate' ? 'bt-cooperate' : 'bt-betray';
      gridEl.innerHTML = `
        <div class="bt-reveal-card ${v1cls}">
          <div class="rmc-name">${p1name}</div>
          <div class="bt-reveal-emoji">${v1 === 'cooperate' ? '🤝' : '🔪'}</div>
          <div class="bt-reveal-choice">${v1 === 'cooperate' ? 'COOPERATE' : 'BETRAY'}</div>
        </div>
        <div class="bt-reveal-card ${v2cls}">
          <div class="rmc-name">${p2name}</div>
          <div class="bt-reveal-emoji">${v2 === 'cooperate' ? '🤝' : '🔪'}</div>
          <div class="bt-reveal-choice">${v2 === 'cooperate' ? 'COOPERATE' : 'BETRAY'}</div>
        </div>`;
    }

    function btSetDelta(id, val) {
      const el = document.getElementById(id); if (!el) return;
      el.textContent = `${val >= 0 ? '+' : ''}${Math.abs(val)} pts`;
      el.className   = `rmc-delta ${val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral'}`;
    }
    btSetDelta('bt-delta-p1', outcome.p1);
    btSetDelta('bt-delta-p2', outcome.p2);

    document.getElementById('btn-bt-apply')     ?.classList.toggle('hidden',  btLocal.resultApplied);
    document.getElementById('btn-bt-next-round')?.classList.toggle('hidden', !btLocal.resultApplied);
  }
}

// ── Render: player betrayal ────────────────────────────────
export function renderPlayerBetrayal(data) {
  if (!data || data.id !== 'betrayal') return;

  const state  = data.state ?? 'waiting';
  const votes  = data.votes ?? {};
  const myVote = votes[_ctx.playerKey];

  if (state !== 'revealing') btStopCountdown();

  const sections = ['bt-p-waiting','bt-p-voting','bt-p-voted','bt-p-revealing','bt-p-revealed'];
  sections.forEach(id => document.getElementById(id)?.classList.add('hidden'));

  if (state === 'waiting') {
    document.getElementById('bt-p-waiting')?.classList.remove('hidden');
  }

  else if (state === 'active') {
    if (myVote == null) {
      const btnC = document.getElementById('btn-cooperate');
      const btnB = document.getElementById('btn-betray');
      if (btnC) btnC.disabled = false;
      if (btnB) btnB.disabled = false;
      document.getElementById('bt-p-voting')?.classList.remove('hidden');
    } else {
      const choiceEl = document.getElementById('bt-p-voted-choice');
      if (choiceEl) {
        choiceEl.textContent = myVote === 'cooperate' ? '🤝 YOU CHOSE: COOPERATE' : '🔪 YOU CHOSE: BETRAY';
        choiceEl.style.color = myVote === 'cooperate' ? 'var(--green)' : 'var(--red)';
      }
      document.getElementById('bt-p-voted')?.classList.remove('hidden');
    }
  }

  else if (state === 'revealing') {
    document.getElementById('bt-p-revealing')?.classList.remove('hidden');
    const revealTime = data.revealTime ?? (Date.now() + 5000);
    btStartCountdown(revealTime, 'bt-p-countdown');
  }

  else if (state === 'revealed' || state === 'ended') {
    document.getElementById('bt-p-revealed')?.classList.remove('hidden');

    const oppKey     = _ctx.playerKey === 'player1' ? 'player2' : 'player1';
    const myV        = votes[_ctx.playerKey];
    const oppV       = votes[oppKey];
    const outcomeKey = data.outcome ?? getOutcomeKey(votes.player1, votes.player2);
    const outcome    = betrayalOutcomes?.[outcomeKey] ?? { p1: 0, p2: 0 };
    const myDelta    = _ctx.playerKey === 'player1' ? outcome.p1 : outcome.p2;

    const outEl = document.getElementById('bt-p-outcome-text');
    if (outEl) {
      if (myDelta > 0) {
        outEl.textContent = `+${myDelta} pts`;           outEl.className = 'rb-player-result-text won';
      } else if (myDelta < 0) {
        outEl.textContent = `-${Math.abs(myDelta)} pts`; outEl.className = 'rb-player-result-text lost';
      } else {
        outEl.textContent = '0 pts change';               outEl.className = 'rb-player-result-text neutral';
      }
    }

    const gridEl = document.getElementById('bt-p-reveal-grid');
    if (gridEl && myV && oppV) {
      const myVcls  = myV  === 'cooperate' ? 'bt-cooperate' : 'bt-betray';
      const oppVcls = oppV === 'cooperate' ? 'bt-cooperate' : 'bt-betray';
      gridEl.innerHTML = `
        <div class="bt-reveal-card ${myVcls}">
          <div class="rmc-name">YOU</div>
          <div class="bt-reveal-emoji">${myV  === 'cooperate' ? '🤝' : '🔪'}</div>
          <div class="bt-reveal-choice">${myV  === 'cooperate' ? 'COOPERATE' : 'BETRAY'}</div>
        </div>
        <div class="bt-reveal-card ${oppVcls}">
          <div class="rmc-name">THEM</div>
          <div class="bt-reveal-emoji">${oppV === 'cooperate' ? '🤝' : '🔪'}</div>
          <div class="bt-reveal-choice">${oppV === 'cooperate' ? 'COOPERATE' : 'BETRAY'}</div>
        </div>`;
    }
  }
}

// ── Player: cast vote ──────────────────────────────────────
async function castVote(choice) {
  if (!_ctx.playerKey) return;
  const btnC = document.getElementById('btn-cooperate');
  const btnB = document.getElementById('btn-betray');
  if (btnC) btnC.disabled = true;
  if (btnB) btnB.disabled = true;

  // Optimistic UI transition
  const choiceEl = document.getElementById('bt-p-voted-choice');
  if (choiceEl) {
    choiceEl.textContent = choice === 'cooperate' ? '🤝 YOU CHOSE: COOPERATE' : '🔪 YOU CHOSE: BETRAY';
    choiceEl.style.color = choice === 'cooperate' ? 'var(--green)' : 'var(--red)';
  }
  document.getElementById('bt-p-voting')?.classList.add('hidden');
  document.getElementById('bt-p-voted') ?.classList.remove('hidden');

  try {
    // Guard: only write to the path matching this player's key
    if (_ctx.playerKey !== 'player1' && _ctx.playerKey !== 'player2') return;
    await _ctx.update(_ctx.ref(_ctx.db, 'round/votes'), { [_ctx.playerKey]: choice });
  } catch (err) {
    console.error('[Betrayal] Vote error:', err);
    if (btnC) btnC.disabled = false;
    if (btnB) btnB.disabled = false;
    document.getElementById('bt-p-voting')?.classList.remove('hidden');
    document.getElementById('bt-p-voted') ?.classList.add('hidden');
  }
}

// ── Module init — called from main.js ─────────────────────
export function init(ctx) {
  _ctx = ctx;

  // Build outcome matrix now that _ctx is available
  betrayalOutcomes = {
    both_cooperate: { p1: _ctx.MONEY_EVENTS.BETRAYAL_BOTH_COOPERATE, p2: _ctx.MONEY_EVENTS.BETRAYAL_BOTH_COOPERATE },
    p1_betrays:     { p1: _ctx.MONEY_EVENTS.BETRAYAL_BETRAY_WIN,     p2: _ctx.MONEY_EVENTS.BETRAYAL_BETRAY_LOSS    },
    p2_betrays:     { p1: _ctx.MONEY_EVENTS.BETRAYAL_BETRAY_LOSS,    p2: _ctx.MONEY_EVENTS.BETRAYAL_BETRAY_WIN     },
    both_betray:    { p1: _ctx.MONEY_EVENTS.BETRAYAL_BOTH_BETRAY,    p2: _ctx.MONEY_EVENTS.BETRAYAL_BOTH_BETRAY    },
  };

  // HOST: START BETRAYAL
  btnBtStart = document.getElementById('btn-bt-start');
  if (btnBtStart) {
    btnBtStart.addEventListener('click', async () => {
      btnBtStart.disabled = true;
      btLocal = { resultApplied: false };
      btCountdownStarted    = false;
      btHostRevealScheduled = false;
      try {
        _ctx.flashTransition('var(--red)', 600);
        await _ctx.set(_ctx.ref(_ctx.db, 'round'), {
          id:         'betrayal',
          state:      'active',
          votes:      { player1: null, player2: null },
          revealTime: null,
          outcome:    null,
          winner:     null,
          answers: {}, stackerScores: {}, timer: 0, question: '',
        });
      } catch (err) {
        console.error('[Betrayal] Start error:', err);
        btnBtStart.disabled = false;
      }
    });
  }

  // HOST: TRIGGER REVEAL
  const btnBtReveal = document.getElementById('btn-bt-reveal');
  if (btnBtReveal) {
    btnBtReveal.addEventListener('click', async () => {
      btnBtReveal.disabled  = true;
      btHostRevealScheduled = false; // re-set by renderHostBetrayal on next render
      const revealTime      = Date.now() + 5000;
      try {
        _ctx.flashTransition('var(--red)', 400);
        await _ctx.update(_ctx.ref(_ctx.db, 'round'), { state: 'revealing', revealTime });
      } catch (err) {
        console.error('[Betrayal] Trigger reveal error:', err);
        btnBtReveal.disabled = false;
      }
    });
  }

  // HOST: APPLY RESULTS
  const btnBtApply = document.getElementById('btn-bt-apply');
  if (btnBtApply) {
    btnBtApply.addEventListener('click', async () => {
      if (btLocal.resultApplied) return;
      btnBtApply.disabled = true;
      btLocal.resultApplied = true;
      try {
        const [roundSnap, playersSnap] = await Promise.all([
          _ctx.get(_ctx.ref(_ctx.db, 'round')),
          _ctx.get(_ctx.ref(_ctx.db, 'players')),
        ]);
        const rd         = roundSnap.val();
        const pd         = playersSnap.val();
        const votes      = rd?.votes ?? {};
        const outcomeKey = rd?.outcome ?? getOutcomeKey(votes.player1, votes.player2);
        const outcome    = betrayalOutcomes?.[outcomeKey] ?? { p1: 0, p2: 0 };

        if (!pd?.player1 || !pd?.player2) throw new Error('Missing player data');
        const newB1 = Math.max(0, Math.round((pd.player1.points ?? 0) + outcome.p1));
        const newB2 = Math.max(0, Math.round((pd.player2.points ?? 0) + outcome.p2));

        _ctx.flashTransition('var(--green)', 700);
        await _ctx.update(_ctx.ref(_ctx.db, 'players'), {
          'player1/points': newB1, 'player1/alive': newB1 > 0,
          'player2/points': newB2, 'player2/alive': newB2 > 0,
        });
        // Mark ended and clear votes so they don't leak into next rounds
        await _ctx.update(_ctx.ref(_ctx.db, 'round'), {
          state: 'ended',
          'votes/player1': null,
          'votes/player2': null,
        });

        btnBtApply.classList.add('hidden');
        document.getElementById('btn-bt-next-round')?.classList.remove('hidden');
      } catch (err) {
        console.error('[Betrayal] Apply error:', err);
        btLocal.resultApplied = false;
        btnBtApply.disabled   = false;
      }
    });
  }

  // HOST: NEXT ROUND (6 → 7)
  const btnBtNextRound = document.getElementById('btn-bt-next-round');
  if (btnBtNextRound) {
    btnBtNextRound.addEventListener('click', async () => {
      btnBtNextRound.disabled = true;
      try {
        await _ctx.roundWipeTransition('WHEEL OF FATE');
        await _ctx.update(_ctx.ref(_ctx.db, 'game'), { currentRound: 7 });
      } catch (err) {
        console.error('[Betrayal] Next round error:', err);
        btnBtNextRound.disabled = false;
      }
    });
  }

  // PLAYER: cast vote buttons
  if (_ctx.view === 'player') {
    document.getElementById('btn-cooperate')?.addEventListener('click', () => castVote('cooperate'));
    document.getElementById('btn-betray')   ?.addEventListener('click', () => castVote('betray'));
  }
}
