# Architecture — MR-BEAST-GAME

Everything lives in one file: `index.html`. HTML + CSS + JS are co-located for zero-build simplicity. Firebase Realtime Database is the only backend.

---

## URL Routing (How Views Are Chosen)

| URL | Role |
|-----|------|
| `?view=host` | Host/Player 1 — controls the game |
| `?view=player&player=player2` | Guest Player 2 |
| `?view=player&player=player3` | Guest Player 3 (up to player8) |
| *(no params)* | `#no-route` splash with links |

Parsed at boot via `URLSearchParams`. The `view` variable and `playerKey` variable are set once and never change for the lifetime of the page.

> Host is **always** `player1`. Guests are `player2`–`player8`.

---

## Firebase Realtime Database Schema

```
/game
  currentRound:   number   (0 = lobby, 1–8 = active round)
  players:        number   (count of connected players)

/players
  /player1
    name:           string
    points:         number
    startingPoints: number
    alive:          boolean
    ready:          boolean
  /player2 ... /player8   (same shape)

/round
  id:       string   ('trivia' | 'redbutton' | 'typewave' | 'stacker' | 'tapbattle' | 'betrayal' | 'reaction' | 'wheel')
  state:    string   ('waiting' | 'active' | 'ended' | 'subresult' | 'go')
  winner:   string   ('player1' | 'player2' | 'tie' | null)

  // Round-specific fields (merged onto /round, overwritten each round)
  // Trivia
  questionIndex:  number
  question:       string
  answers:        { player1: string, player2: string }
  scores:         { player1: number, player2: number }  // correct-answer count

  // Red Button
  scores:         { player1: number, player2: number }  // wins count
  presser:        string   // who pressed last

  // Typewave
  word:           string   // unscrambled word
  scrambled:      string
  wordScores:     { player1: number, player2: number }
  wrongCounts:    { player1: number, player2: number }

  // Stacker
  levels:         { player1: number, player2: number }
  done:           { player1: boolean, player2: boolean }

  // Tap Battle
  taps:           { player1: number, player2: number }
  done:           { player1: boolean, player2: boolean }

  // Betrayal
  votes:          { player1: string, player2: string }   // 'cooperate' | 'betray'
  votedAt:        { player1: number, player2: number }   // timestamps

  // Reaction
  scores:         { player1: number, player2: number }
  reactionMs:     { player1: number, player2: number }

  // Wheel
  spins:          { player1: number, player2: number }   // segment index
  multipliers:    { player1: number, player2: number }
  done:           { player1: boolean, player2: boolean }
```

---

## Key JavaScript Constants

```js
// Round order — index + 1 = currentRound number
const ROUND_ORDER = ['trivia', 'redbutton', 'typewave', 'stacker', 'tapbattle', 'betrayal', 'reaction', 'wheel'];

// All point deltas in one place — change here to rebalance
const POINT_EVENTS = { ... };
const MONEY_EVENTS = POINT_EVENTS; // alias, same object

// Wheel prize multipliers
const WHEEL_SEGMENTS = [ { label, multiplier, color }, ... ];

// Trivia questions — edit to customize for any birthday
const TRIVIA_QUESTIONS = [ { q: string, a: string }, ... ];
```

---

## Core Functions

| Function | What It Does |
|----------|-------------|
| `showView(which)` | Hides/shows the correct `<div id="...">` view panel |
| `buildPtsBar(playersData)` | Rebuilds the always-visible top money/points bar |
| `updateHostCards(playersData)` | Updates lobby player cards in host view |
| `showCountdown(label)` | Shows the 3-2-1 overlay with an animated number |
| `renderHost<Round>(data, players)` | Per-round host rendering (one per round) |
| `renderPlayer<Round>(data)` | Per-round player rendering (one per round) |
| `initGameState()` | Seeds Firebase with default game object (host only, runs once) |

---

## Data Flow

```
Host action (button click)
  → await update(ref(db, 'round'), { ... })
      → Firebase propagates to all listeners
          → onValue(ref(db, 'round'), ...) fires on ALL clients
              → renderHost<Round>() or renderPlayer<Round>() called
                  → DOM updated
```

All state is in Firebase. No local state is authoritative except:
- `triviaLocal` — ephemeral judging flags (not synced, host-only)
- `rbLocal`, `twLocal`, etc. — same pattern per round
- Canvas game state (Stacker, TapBattle) — computed locally, final score pushed to Firebase

---

## Rendering Pattern (Every Round)

Each round has **three sub-states** driven by `round.state`:

| `round.state` | What Shows |
|---------------|-----------|
| `'waiting'` | Pre-start panel (rules + START button) |
| `'active'` | Live gameplay UI |
| `'ended'` | Results + APPLY RESULTS button |

The `renderHost*` functions toggle `.hidden` on the correct sub-panel based on this state. Player `render*` functions do the same.

---

## CSS Architecture

All CSS is in one `<style>` block. Organized as:
1. CSS Variables (`:root`)
2. Reset / Base
3. Utility (`.hidden`, `.view`)
4. Global components (money bar, countdown overlay, flash, wipe, confetti)
5. Per-view/per-round sections (commented headers)

CSS variables to know:
```css
--pink: #FF69B4     /* primary accent */
--green: #00FF87    /* positive / win */
--red: #FF2D2D      /* negative / lose */
--yellow: #FFD700   /* gold */
--bg: #0a0a0a       /* page background */
--font-display: 'Bebas Neue'
--font-body: 'DM Sans'
--font-birthday: 'Dancing Script'
```

---

## Adding a New Round

1. Add the round `id` to `ROUND_ORDER` (line ~3676) and `ROUND_NAMES`.
2. Add `ALL_ROUND_IDS` entry (same array, just the JS alias used by routing).
3. Create host HTML panel `<div id="host-<id>" class="hidden">` inside `#host-view`.
4. Create player HTML panel inside `#player-view`.
5. Write `renderHost<Id>(data, playersData)` and `renderPlayer<Id>(data)`.
6. Add cases for `roundId === '<id>'` inside the main `onValue(ref(db, 'round'), ...)` listener.
7. Add point events to `POINT_EVENTS`.
8. Wire the APPLY RESULTS button to update `/players` via `update(ref(db, 'players'), {...})`.
