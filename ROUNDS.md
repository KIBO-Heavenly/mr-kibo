# Rounds Reference — MR-BEAST-GAME

All 8 rounds in order. Includes mechanics, point deltas, Firebase fields written, and gotchas.

---

## Round 1 — Who Knows Me Better? (Trivia)

**Type:** Host-judged Q&A  
**Questions:** 10 (defined in `TRIVIA_QUESTIONS` array, line ~4296)

### Flow
1. Host clicks **START ROUND** → `round.state = 'active'`, `round.questionIndex = 0`
2. Both players see the question and type their answer → pushed to `round.answers.player1/2`
3. Host sees both answers and clicks ✓ or ✗ for each
4. Host clicks **NEXT QUESTION** → increments `round.questionIndex`
5. After last question, **FINISH ROUND** button appears → `round.state = 'ended'`, sets `round.winner`
6. Host clicks **APPLY RESULTS** → transfers points

### Point Events
| Event | Delta |
|-------|-------|
| Each correct answer | +5 pts |
| Winner (most correct) | +20 pts |
| Loser | −20 pts |
| Tie | no transfer |

### Key Firebase Writes
```
round.state = 'active'
round.question = TRIVIA_QUESTIONS[idx].q
round.questionIndex = idx
round.answers.player1 / round.answers.player2
round.scores.player1 / round.scores.player2
round.winner = 'player1' | 'player2' | 'tie'
players.player1.points / players.player2.points  (on APPLY)
```

### Gotchas
- `triviaLocal.resultApplied` prevents double-apply on fast double-click.
- Answers are personalized to Veronica — `a: "Ask her!"` means judge manually by what she says.
- Correct answer hint is hidden by default, shown when host clicks a correct judge button.

---

## Round 2 — Red Button

**Type:** Reaction-tap race, best of 7 sub-points  
**Winner condition:** First to 4 points

### Flow
1. Host starts round → `round.state = 'active'`
2. Host side auto-arms button after a random delay (1.5–4.5s)
3. Button appears at a random screen position for both players simultaneously
4. First player to tap it gets the point → `round.scores.playerX++`, `round.state = 'subresult'` briefly
5. After 7 sub-points, `round.state = 'ended'`
6. Host applies results

### Point Events
| Event | Delta |
|-------|-------|
| Per sub-round win | +20 pts |
| Per sub-round loss | −10 pts |

> Net per sub-round: winner nets +30 over loser per point.

### Key Firebase Writes
```
round.state = 'go'          (button is live)
round.presser = 'player1'   (who tapped first)
round.scores = { player1, player2 }
round.state = 'subresult' → then 'active' again for next sub-round
round.state = 'ended'
```

### Gotchas
- The button is `position: fixed`, rendered globally as `#rb-small-btn`, managed by JS position/display.
- `rbLocal.resultApplied` prevents double-apply.
- Host has a **Force End** button to end the round early.

---

## Round 3 — Typewave

**Type:** Unscramble race, first to 5 words wins  
**Penalty:** Wrong guesses cost points immediately

### Flow
1. Host starts → `round.state = 'active'`, first scrambled word pushed
2. Both players see scrambled word, type guesses in real-time
3. Each player's input is checked client-side against `round.word`
4. First correct answer → wins that word, scores updated, next word pushed
5. Wrong answers → `wrongCounts.playerX++` (tracked for penalty)
6. First to 5 words → `round.state = 'ended'`

### Point Events
| Event | Delta |
|-------|-------|
| Winner (5 words first) | +25 pts |
| Loser | −15 pts |
| Each wrong answer | −5 pts |
| Tie (simultaneous) | no win transfer, still pay wrong penalties |

### Key Firebase Writes
```
round.word       (correct answer, lowercase)
round.scrambled  (shuffled version shown to players)
round.wordScores = { player1, player2 }
round.wrongCounts = { player1, player2 }
round.state = 'ended'
```

### Gotchas
- Word checking is case-insensitive, trimmed. Input auto-uppercased for display.
- Wrong-count penalty applied on APPLY RESULTS, not in real-time.
- Timer ring (SVG stroke animation) is purely cosmetic — no auto-timeout.

---

## Round 4 — Stacker

**Type:** Arcade block-stacking game (canvas), both play simultaneously  
**Winner condition:** Higher stack level when both finish

### Flow
1. Host starts → `round.state = 'active'`
2. Each player plays the Stacker mini-game on their own device (canvas tap)
3. Tap to stop the moving row — rows stack if they align, game ends on miss
4. Final level pushed to `round.levels.playerX`, `round.done.playerX = true`
5. When both done → `round.state = 'ended'`
6. Host applies results

### Point Events
| Event | Delta |
|-------|-------|
| Higher level wins | +25 pts |
| Lower level loses | −15 pts |
| Tie (same level) | +5 pts each |

### Key Firebase Writes
```
round.state = 'active'
round.levels = { player1: N, player2: N }
round.done = { player1: true, player2: true }
round.state = 'ended'
round.winner
```

### Gotchas
- Canvas size is responsive — `max-width: 340px`, scales via `calc(100% - 32px)`.
- Speed increases with each level (set in `STACKER_SPEEDS` or inline).
- The canvas game loop runs locally; only the final score goes to Firebase.

---

## Round 5 — Tap Battle

**Type:** Tap-as-fast-as-possible race over a fixed duration  
**Winner condition:** Most taps when time expires

### Flow
1. Host starts → `round.state = 'active'`, countdown begins
2. Both players mash their screen during the window
3. Each tap increments `round.taps.playerX` in Firebase
4. Timer expires → both clients push `round.done.playerX = true`
5. Winner determined by tap count → `round.state = 'ended'`

### Point Events
| Event | Delta |
|-------|-------|
| Winner (most taps) | +25 pts |
| Loser | −15 pts |

### Key Firebase Writes
```
round.state = 'active'
round.taps = { player1: N, player2: N }  (incremented per tap)
round.done = { player1: true, player2: true }
round.state = 'ended'
round.winner
```

### Gotchas
- Rapid Firebase writes per tap — if latency is high, taps may lag. Consider debouncing or batching.
- Host spectator panel shows live tap counts.

---

## Round 6 — Betrayal (Prisoner's Dilemma)

**Type:** Simultaneous secret vote — Cooperate or Betray  
**Outcome:** Points depend on the combination of both votes

### Flow
1. Host starts → `round.state = 'active'`, timer countdown shown
2. Each player secretly votes Cooperate or Betray
3. Votes pushed to `round.votes.playerX`
4. When both vote (or timer expires) → `round.state = 'ended'`
5. Host reveals votes and applies matrix result

### Point Matrix
| P1 Vote | P2 Vote | P1 Delta | P2 Delta |
|---------|---------|----------|----------|
| Cooperate | Cooperate | +15 | +15 |
| Betray | Cooperate | +30 | −20 |
| Cooperate | Betray | −20 | +30 |
| Betray | Betray | −10 | −10 |

### Key Firebase Writes
```
round.state = 'active'
round.votes = { player1: 'cooperate'|'betray', player2: ... }
round.votedAt = { player1: timestamp, player2: timestamp }
round.state = 'ended'
```

### Gotchas
- Votes are revealed simultaneously when host hits APPLY — players don't see each other's vote before that.
- Timer is decorative on the host side; host manually ends if needed.

---

## Round 7 — Reaction Test

**Type:** Flash stimulus → tap as fast as possible, N rounds, lowest total time wins

### Flow
1. Host starts → `round.state = 'active'`
2. Screen flashes a signal (color change, text) after a random delay
3. Players tap ASAP — reaction time in ms recorded
4. Multiple sub-rounds, cumulative time tracked
5. Lower total reaction time wins → `round.state = 'ended'`

### Point Events
| Event | Delta |
|-------|-------|
| Lower cumulative reaction time | +20 pts |
| Higher cumulative reaction time | −10 pts |

### Key Firebase Writes
```
round.state = 'go'   (stimulus fires)
round.reactionMs = { player1: N, player2: N }
round.scores = { player1: N, player2: N }  (sub-round wins)
round.state = 'ended'
round.winner
```

---

## Round 8 — Wheel of Fate (Finale)

**Type:** Spin-the-wheel multiplier applied to each player's total points  
**This is the last round — no more after this**

### Flow
1. Host starts → each player gets to spin their own wheel
2. Wheel lands on a multiplier segment
3. Player's final points = `current points × multiplier`
4. After both spin → APPLY RESULTS & FINALE → goes to results screen

### Wheel Segments
| Label | Multiplier |
|-------|-----------|
| 0.5× 💀 | ×0.5 |
| 0.75× 😬 | ×0.75 |
| 1× 😐 | ×1.0 (×2) |
| 1.25× 😏 | ×1.25 |
| 2× 🎉 | ×2.0 |

### Key Firebase Writes
```
round.state = 'active'
round.spins = { player1: segmentIndex, player2: segmentIndex }
round.multipliers = { player1: 1.5, player2: 0.5 }
round.done = { player1: true, player2: true }
round.state = 'ended'
players.player1.points = Math.round(points * multiplier)
```

### Gotchas
- Segment index is picked by host (random via `Math.floor(Math.random() * WHEEL_SEGMENTS.length)`).
- The `SpinWheel` class animates to the predetermined index — result is fixed before spin starts.
- Points floored/rounded to integer after multiply.

---

## Customizing Questions / Words / Wheel

| Thing to Change | Location |
|----------------|----------|
| Trivia questions | `TRIVIA_QUESTIONS` array, line ~4296 |
| Typewave word list | Defined inline in typewave start logic — grep `pickNextWord` or `tw_word` |
| Wheel segments | `WHEEL_SEGMENTS` array, line ~7145 |
| All point values | `POINT_EVENTS` object, line ~3650 |
| Starting balance | Set in `initGameState()` → `points: 0` |
