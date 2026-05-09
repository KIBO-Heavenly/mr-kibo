// ════════════════════════════════════════════════════════════
// ROUND 1 — WHO KNOWS ME BETTER (TRIVIA)
// ════════════════════════════════════════════════════════════

let _ctx;
let btnStartTrivia; // referenced in both init() and renderHostTrivia()

// ✏️ EDIT YOUR TRIVIA QUESTIONS HERE
const TRIVIA_QUESTIONS = [
  { q: "What is Veronica's favorite color?",                        a: "Ask her!" },
  { q: "What is Veronica's favorite food?",                         a: "Ask her!" },
  { q: "What year was Veronica born?",                              a: "Ask her!" },
  { q: "What is Veronica's favorite movie?",                        a: "Ask her!" },
  { q: "What is Veronica's favorite holiday?",                      a: "Ask her!" },
  { q: "What is Veronica's dream vacation destination?",            a: "Ask her!" },
  { q: "What was Veronica's childhood nickname?",                   a: "Ask her!" },
  { q: "What is Veronica's go-to karaoke song?",                    a: "Ask her!" },
  { q: "What sport or hobby does Veronica love most?",              a: "Ask her!" },
  { q: "What is one thing Veronica always says?",                   a: "Ask her!" },
];

// Host-side ephemeral trivia state (not pushed to Firebase)
let triviaLocal = { judgedP1: false, judgedP2: false, resultApplied: false };

// ── Render: host trivia ────────────────────────────────────
export function renderHostTrivia(roundData, playersData) {
  if (!roundData || roundData.id !== 'trivia') return;

  const state  = roundData.state          ?? 'waiting';
  const qIdx   = roundData.questionIndex  ?? 0;
  const scores = roundData.scores         ?? { player1: 0, player2: 0 };

  const prestart = document.getElementById('host-trivia-prestart');
  const active   = document.getElementById('host-trivia-active');
  const result   = document.getElementById('host-trivia-result');

  prestart.classList.toggle('hidden', state !== 'waiting');
  active  .classList.toggle('hidden', state !== 'active');
  result  .classList.toggle('hidden', state !== 'ended');
  if (state === 'waiting' && btnStartTrivia) btnStartTrivia.disabled = false;

  // --- Player names in score + answer headers ---
  const p1name = playersData?.player1?.name || 'Player 1';
  const p2name = playersData?.player2?.name || 'Player 2';
  ['host-trivia-sn1', 'host-trivia-p1-label', 'trivia-rmc-name-p1'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = p1name;
  });
  ['host-trivia-sn2', 'host-trivia-p2-label', 'trivia-rmc-name-p2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = p2name;
  });

  if (state === 'active') {
    // Scores
    document.getElementById('host-trivia-s1').textContent = scores.player1 ?? 0;
    document.getElementById('host-trivia-s2').textContent = scores.player2 ?? 0;

    // Question
    document.getElementById('host-trivia-q-num').textContent = qIdx + 1;
    document.getElementById('host-trivia-q-text').textContent = TRIVIA_QUESTIONS[qIdx]?.q ?? '';
    // Show expected answer to host only
    const answerHintEl = document.getElementById('host-trivia-q-answer');
    if (answerHintEl) {
      const ans = TRIVIA_QUESTIONS[qIdx]?.a;
      answerHintEl.textContent = ans ? `Expected: ${ans}` : '';
      answerHintEl.style.display = ans ? '' : 'none';
    }

    // Live answers from players
    const answers = roundData.answers ?? {};
    const p1ans = answers.player1 ?? '';
    const p2ans = answers.player2 ?? '';

    const ans1El = document.getElementById('host-trivia-ans-p1');
    const ans2El = document.getElementById('host-trivia-ans-p2');

    ans1El.textContent = p1ans || 'waiting…';
    ans1El.classList.toggle('no-answer', !p1ans);
    ans2El.textContent = p2ans || 'waiting…';
    ans2El.classList.toggle('no-answer', !p2ans);

    // Show NEXT vs FINISH button
    const isLast = qIdx >= TRIVIA_QUESTIONS.length - 1;
    document.getElementById('btn-trivia-next')  .classList.toggle('hidden',  isLast);
    document.getElementById('btn-trivia-finish').classList.toggle('hidden', !isLast);

    updateJudgeUI();
  }

  if (state === 'ended') renderTriviaResult(roundData, playersData);
}

// Update judge buttons + badges based on triviaLocal
function updateJudgeUI() {
  const disableP1 = triviaLocal.judgedP1;
  const disableP2 = triviaLocal.judgedP2;

  document.querySelectorAll('.judge-p1-btn').forEach(b => b.disabled = disableP1);
  document.querySelectorAll('.judge-p2-btn').forEach(b => b.disabled = disableP2);

  const badge1 = document.getElementById('host-trivia-badge-p1');
  const badge2 = document.getElementById('host-trivia-badge-p2');
  if (badge1) badge1.classList.toggle('hidden', !disableP1);
  if (badge2) badge2.classList.toggle('hidden', !disableP2);
}

// ── Render: trivia result (host) ───────────────────────────
function renderTriviaResult(roundData, playersData) {
  const scores  = roundData.scores ?? { player1: 0, player2: 0 };
  const winner  = roundData.winner;
  const s1      = scores.player1 ?? 0;
  const s2      = scores.player2 ?? 0;
  const p1name  = playersData?.player1?.name || 'Player 1';
  const p2name  = playersData?.player2?.name || 'Player 2';

  const winnerEl = document.getElementById('trivia-result-winner');
  const subEl    = document.getElementById('trivia-result-sub');
  const d1El     = document.getElementById('trivia-delta-p1');
  const d2El     = document.getElementById('trivia-delta-p2');

  if (winner === 'tie') {
    winnerEl.textContent = "IT'S A TIE!";
    subEl.textContent    = `Both scored ${s1} — no points change`;
    d1El.textContent = '+0 pts'; d1El.className = 'rmc-delta neutral';
    d2El.textContent = '+0 pts'; d2El.className = 'rmc-delta neutral';
  } else if (winner === 'player1') {
    winnerEl.textContent = `${p1name} WINS!`;
    subEl.textContent    = `${s1} vs ${s2} correct — ${p1name} gets +20 pts from ${p2name}`;
    d1El.textContent = '+20 pts'; d1El.className = 'rmc-delta positive';
    d2El.textContent = '-20 pts'; d2El.className = 'rmc-delta negative';
  } else {
    winnerEl.textContent = `${p2name} WINS!`;
    subEl.textContent    = `${s2} vs ${s1} correct — ${p2name} gets +20 pts from ${p1name}`;
    d1El.textContent = '-20 pts'; d1El.className = 'rmc-delta negative';
    d2El.textContent = '+20 pts'; d2El.className = 'rmc-delta positive';
  }

  const applyBtn = document.getElementById('btn-trivia-apply');
  if (applyBtn) applyBtn.classList.toggle('hidden', triviaLocal.resultApplied);
}

// ── Render: player trivia ──────────────────────────────────
export function renderPlayerTrivia(roundData) {
  if (!roundData || roundData.id !== 'trivia') return;

  const state  = roundData.state         ?? 'waiting';
  const qIdx   = roundData.questionIndex ?? 0;
  const scores = roundData.scores        ?? { player1: 0, player2: 0 };

  const waitingEl = document.getElementById('player-trivia-waiting');
  const activeEl  = document.getElementById('player-trivia-active');
  const endedEl   = document.getElementById('player-trivia-ended');

  if (waitingEl) waitingEl.classList.toggle('hidden', state !== 'waiting');
  if (activeEl)  activeEl .classList.toggle('hidden', state !== 'active');
  if (endedEl)   endedEl  .classList.toggle('hidden', state !== 'ended');

  if (state === 'active') {
    const myScore = (_ctx.playerKey === 'player1' ? scores.player1 : scores.player2) ?? 0;
    const scoreEl = document.getElementById('player-trivia-my-score');
    if (scoreEl) scoreEl.innerHTML = `Score: <span>${myScore}</span> / ${TRIVIA_QUESTIONS.length}`;

    const qNumEl  = document.getElementById('player-trivia-q-num');
    const qTextEl = document.getElementById('player-trivia-q-text');
    if (qNumEl)  qNumEl.textContent  = qIdx + 1;
    if (qTextEl) qTextEl.textContent = TRIVIA_QUESTIONS[qIdx]?.q ?? '';

    // Reset input when question index changes
    const ansInput = document.getElementById('player-answer-input');
    const submitBtn = document.getElementById('btn-submit-answer');
    const statusEl  = document.getElementById('player-answer-status');

    if (ansInput && ansInput.dataset.forQ !== String(qIdx)) {
      ansInput.dataset.forQ = String(qIdx);
      ansInput.value = '';
      ansInput.classList.remove('submitted');
      ansInput.disabled = false;
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'SUBMIT ANSWER'; }
      if (statusEl)  { statusEl.textContent = ''; statusEl.className = 'player-answer-status'; }
    }

    // Show judgment feedback from host
    const judgment = roundData.judgments?.[_ctx.playerKey] ?? null;
    if (statusEl && judgment && ansInput?.classList.contains('submitted')) {
      if (judgment === 'correct') {
        statusEl.textContent = '✓ CORRECT!';
        statusEl.className   = 'player-answer-status correct';
      } else if (judgment === 'wrong') {
        statusEl.textContent = '✗ WRONG';
        statusEl.className   = 'player-answer-status wrong';
      }
    }
  }

  if (state === 'ended') {
    const myScore = (_ctx.playerKey === 'player1' ? scores.player1 : scores.player2) ?? 0;
    const endScoreEl = document.getElementById('player-trivia-end-score');
    const endMsgEl   = document.getElementById('player-trivia-end-msg');

    if (endScoreEl)
      endScoreEl.innerHTML = `You got <span>${myScore}</span> / 10 correct`;

    if (endMsgEl) {
      const winner = roundData.winner;
      if (winner === _ctx.playerKey) {
        endMsgEl.textContent  = 'YOU WIN! +20 pts stealing…';
        endMsgEl.style.color  = 'var(--green)';
      } else if (winner === 'tie') {
        endMsgEl.textContent  = "It's a tie — no points change.";
        endMsgEl.style.color  = '#888';
      } else {
        endMsgEl.textContent  = 'You lose. -20 pts will be deducted…';
        endMsgEl.style.color  = 'var(--red)';
      }
    }
  }
}

// ── Host: judge answer ─────────────────────────────────────
async function judgeAnswer(playerNum, correct) {
  const pKey   = `player${playerNum}`;
  const isP1   = playerNum === 1;
  const cardEl = document.getElementById(`host-trivia-card-p${playerNum}`);
  const badge  = document.getElementById(`host-trivia-badge-p${playerNum}`);

  if (isP1) triviaLocal.judgedP1 = true;
  else      triviaLocal.judgedP2 = true;

  // Visual feedback on card
  if (cardEl) {
    cardEl.classList.remove('judged-correct', 'judged-wrong');
    cardEl.classList.add(correct ? 'judged-correct' : 'judged-wrong');
  }
  if (badge) {
    badge.textContent = correct ? 'CORRECT ✓' : 'WRONG ✗';
    badge.className   = `judged-badge ${correct ? 'correct' : 'wrong'}`;
    badge.classList.remove('hidden');
  }

  updateJudgeUI();

  // Write judgment to Firebase so players see right/wrong feedback
  try {
    await _ctx.update(_ctx.ref(_ctx.db, 'round/judgments'), { [pKey]: correct ? 'correct' : 'wrong' });
  } catch (err) {
    console.error('[Trivia] Judgment write error:', err);
  }

  if (!correct) return; // wrong answer → no score change

  // Increment score in Firebase
  try {
    const snap   = await _ctx.get(_ctx.ref(_ctx.db, `round/scores/${pKey}`));
    const curVal = snap.val() ?? 0;
    await _ctx.update(_ctx.ref(_ctx.db, 'round/scores'), { [pKey]: curVal + 1 });
  } catch (err) {
    console.error('[Trivia] Judge error:', err);
  }
}

// ── Player: submit answer ──────────────────────────────────
async function submitTriviaAnswer() {
  const input     = document.getElementById('player-answer-input');
  const submitBtn = document.getElementById('btn-submit-answer');
  const statusEl  = document.getElementById('player-answer-status');
  const answer    = input?.value.trim();

  if (!answer || !_ctx.playerKey) return;

  input.disabled      = true;
  submitBtn.disabled  = true;
  submitBtn.textContent = 'SUBMITTED!';
  input.classList.add('submitted');
  if (statusEl) {
    statusEl.textContent = 'Answer locked in — wait for host…';
    statusEl.className   = 'player-answer-status ok';
  }

  try {
    await _ctx.update(_ctx.ref(_ctx.db, `players/${_ctx.playerKey}`), { answer });
    // Also mirror into /round/answers for host display
    await _ctx.update(_ctx.ref(_ctx.db, 'round/answers'), { [_ctx.playerKey]: answer });
  } catch (err) {
    console.error('[Trivia] Submit answer error:', err);
    // Let player retry
    input.disabled     = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'SUBMIT ANSWER';
    input.classList.remove('submitted');
    if (statusEl) { statusEl.textContent = 'Error — try again'; statusEl.className = 'player-answer-status'; }
  }
}

// ── Module init — called from main.js ─────────────────────
export function init(ctx) {
  _ctx = ctx;

  // HOST: START TRIVIA
  btnStartTrivia = document.getElementById('btn-start-trivia');
  if (btnStartTrivia) {
    btnStartTrivia.addEventListener('click', async () => {
      btnStartTrivia.disabled = true;
      triviaLocal = { judgedP1: false, judgedP2: false, resultApplied: false };
      try {
        _ctx.flashTransition('#FF69B4', 400);
        await _ctx.set(_ctx.ref(_ctx.db, 'round'), {
          id:            'trivia',
          state:         'active',
          questionIndex: 0,
          question:      TRIVIA_QUESTIONS[0].q,
          answers:       { player1: null, player2: null },
          judgments:     { player1: null, player2: null },
          scores:        { player1: 0, player2: 0 },
          winner:        null,
          stackerScores: {},
          timer:         0,
        });
        // Clear player answers in /players
        await _ctx.update(_ctx.ref(_ctx.db, 'players'), {
          'player1/answer': null,
          'player2/answer': null,
        });
      } catch (err) {
        console.error('[Trivia] Start error:', err);
        btnStartTrivia.disabled = false;
      }
    });
  }

  // Wire judge buttons
  ['p1','p2'].forEach(p => {
    const pNum = p === 'p1' ? 1 : 2;
    const btnC = document.getElementById(`btn-judge-${p}-correct`);
    const btnW = document.getElementById(`btn-judge-${p}-wrong`);
    if (btnC) btnC.addEventListener('click', () => judgeAnswer(pNum, true));
    if (btnW) btnW.addEventListener('click', () => judgeAnswer(pNum, false));
  });

  // HOST: NEXT QUESTION
  const btnTriviaNext = document.getElementById('btn-trivia-next');
  if (btnTriviaNext) {
    btnTriviaNext.addEventListener('click', async () => {
      btnTriviaNext.disabled = true;
      const qIdx  = (_ctx.getLatestRoundData()?.questionIndex ?? 0) + 1;
      triviaLocal.judgedP1 = false;
      triviaLocal.judgedP2 = false;

      // Reset card colours
      ['p1','p2'].forEach(p => {
        const card = document.getElementById(`host-trivia-card-${p}`);
        if (card) card.classList.remove('judged-correct', 'judged-wrong');
      });

      try {
        await _ctx.update(_ctx.ref(_ctx.db, 'round'), {
          questionIndex: qIdx,
          question:      TRIVIA_QUESTIONS[qIdx].q,
          answers:       { player1: null, player2: null },
          judgments:     { player1: null, player2: null },
        });
        await _ctx.update(_ctx.ref(_ctx.db, 'players'), {
          'player1/answer': null,
          'player2/answer': null,
        });
        btnTriviaNext.disabled = false;
      } catch (err) {
        console.error('[Trivia] Next question error:', err);
        btnTriviaNext.disabled = false;
      }
    });
  }

  // HOST: FINISH ROUND & REVEAL
  const btnTriviaFinish = document.getElementById('btn-trivia-finish');
  if (btnTriviaFinish) {
    btnTriviaFinish.addEventListener('click', async () => {
      btnTriviaFinish.disabled = true;
      try {
        const scores = _ctx.getLatestRoundData()?.scores ?? { player1: 0, player2: 0 };
        const s1 = scores.player1 ?? 0;
        const s2 = scores.player2 ?? 0;
        const winner = s1 > s2 ? 'player1' : s2 > s1 ? 'player2' : 'tie';

        _ctx.flashTransition('var(--red)', 600);
        await _ctx.update(_ctx.ref(_ctx.db, 'round'), { state: 'ended', winner });
      } catch (err) {
        console.error('[Trivia] Finish error:', err);
        btnTriviaFinish.disabled = false;
      }
    });
  }

  // HOST: APPLY RESULTS (money transfer)
  const btnTriviaApply = document.getElementById('btn-trivia-apply');
  if (btnTriviaApply) {
    btnTriviaApply.addEventListener('click', async () => {
      if (triviaLocal.resultApplied) return;
      btnTriviaApply.disabled = true;
      triviaLocal.resultApplied = true;

      try {
        const roundSnap   = await _ctx.get(_ctx.ref(_ctx.db, 'round'));
        const playersSnap = await _ctx.get(_ctx.ref(_ctx.db, 'players'));
        const roundData   = roundSnap.val();
        const playersData = playersSnap.val();
        const winner      = roundData?.winner;

        if (!winner || winner === 'tie') {
          btnTriviaApply.classList.add('hidden');
          return;
        }

        const loser    = winner === 'player1' ? 'player2' : 'player1';
        if (!playersData[winner] || !playersData[loser]) {
          btnTriviaApply.classList.add('hidden');
          return;
        }
        const wBal     = playersData[winner].points ?? 0;
        const lBal     = playersData[loser].points  ?? 0;
        const steal    = _ctx.MONEY_EVENTS.TRIVIA_STEAL;   // +20
        const stolen   = _ctx.MONEY_EVENTS.TRIVIA_STOLEN;  // -20

        const newWBal  = Math.max(0, Math.round(wBal + steal));
        const newLBal  = Math.max(0, Math.round(lBal + stolen));
        const lAlive   = newLBal > 0;

        await _ctx.update(_ctx.ref(_ctx.db, 'players'), {
          [`${winner}/points`]: newWBal,
          [`${loser}/points`]:  newLBal,
          [`${loser}/alive`]:    lAlive,
        });

        _ctx.flashTransition('var(--green)', 700);
        btnTriviaApply.classList.add('hidden');
      } catch (err) {
        console.error('[Trivia] Apply money error:', err);
        triviaLocal.resultApplied = false;
        btnTriviaApply.disabled = false;
      }
    });

    // Also show NEXT ROUND button after apply fires
    btnTriviaApply.addEventListener('click', () => {
      setTimeout(() => document.getElementById('btn-trivia-next-round')?.classList.remove('hidden'), 1800);
    });
  }

  // HOST: NEXT ROUND (1 → 2)
  const btnTriviaNextRound = document.getElementById('btn-trivia-next-round');
  if (btnTriviaNextRound) {
    btnTriviaNextRound.addEventListener('click', async () => {
      btnTriviaNextRound.disabled = true;
      try {
        await _ctx.roundWipeTransition('ROUND 2');
        await _ctx.update(_ctx.ref(_ctx.db, 'game'), { currentRound: 2 });
      } catch (err) {
        console.error('[Trivia] Next round error:', err);
        btnTriviaNextRound.disabled = false;
      }
    });
  }

  // PLAYER: submit answer
  if (_ctx.view === 'player') {
    const ansInput  = document.getElementById('player-answer-input');
    const submitBtn = document.getElementById('btn-submit-answer');
    if (submitBtn) submitBtn.addEventListener('click', submitTriviaAnswer);
    if (ansInput)  ansInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitTriviaAnswer(); });
  }
}
