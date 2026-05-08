# TODO & Ideas — MR-BEAST-GAME

Track of known issues, quick wins, and future ideas. Add to this whenever something comes up.

---

## Known Issues / Gotchas

- [x] **Wheel aesthetic mismatch** — `btn-primary` / `btn-secondary` had no CSS (fell back to browser default grey buttons); `btn-spin` used a gradient + 10px radius inconsistent with the rest of the game. Fixed: defined `.btn-primary` (pink) and `.btn-secondary` (green) to match the game's shared button language; unified `.btn-spin` to flat pink + 6px radius + matching box-shadow; updated wheel segment neutral-grey colors and added a pink outer rim + thicker center cap on the canvas.
- [ ] **Trivia questions are placeholder** — all answers say `"Ask her!"`. Replace with real answers about Veronica before playing.
- [ ] **Tap Battle Firebase writes** — each tap fires a separate `update()` to Firebase. Under bad network conditions, taps can be lost or throttled by Firebase's rate limiter. Consider counting locally and syncing every 250ms instead.
- [ ] **Double-apply guard is ephemeral** — the `resultApplied` flag lives in local JS state (`triviaLocal`, `rbLocal`, etc.). If the host refreshes mid-round, the flag resets and they could double-apply points. Guard needs Firebase persistence (e.g., `round.applied: true`) to be bulletproof.
- [ ] **No player disconnect detection** — if a player closes their tab, the host has no indication. Firebase `.onDisconnect()` could set `players.playerX.alive = false`.
- [ ] **Typewave word list** — confirm where the word list is defined and whether it can run out of words if the round goes long.
- [ ] **Reaction round random delay** — verify there's a minimum floor (e.g., ≥ 1.5s) to prevent near-instant triggers that feel unfair.

---

## Quick Wins (Easy, High Value)

- [ ] Replace trivia `a: "Ask her!"` with Veronica's real answers before the party.
- [ ] Add a **"Reset Game"** button to the master controls that wipes `/game` and `/round` in Firebase — useful for replays without refreshing every device.
- [ ] The money bar is hidden in the lobby (`class="hidden"`). Show player names + "0 pts" from the moment they lock in their name so players can see they're registered.
- [ ] Add a `round.applied` flag to Firebase on each APPLY RESULTS click so double-apply is impossible even after refresh.

---

## Feature Ideas (Bigger)

- [ ] **Sound effects** — a quick win buzz, a loss buzz, countdown beeps, coin sounds on point changes. The Web Audio API can do basic tones with zero assets.
- [ ] **Confetti on round win** — confetti canvas already exists and is wired up; make it fire per-round too, not just at the finale.
- [ ] **More trivia questions** — the array supports any number. Add 20–30 so repeat plays feel fresh.
- [ ] **Player avatars / emoji** — let each player pick an emoji at name-lock that appears in the scorebar and on cards.
- [ ] **Spectator mode** — `?view=spectator` that shows the host view in read-only mode (no buttons) on a TV/big screen.
- [ ] **Score history log** — show a timeline of who gained/lost points and when, visible on the finale screen.

---

## Code Quality Notes

- The file is ~7000+ lines. When adding significant features, keep the pattern: new HTML section → new render functions → new Firebase listener cases → new POINT_EVENTS entries.
- Every round duplicates the `APPLY RESULTS` pattern. If adding a 3rd player, each round's apply logic will need to be generalized.
- `MONEY_EVENTS` is an alias for `POINT_EVENTS` — they're the same object. The alias exists from a rename. Pick one and stick with it in new code.
- CSS class names use BEM-ish prefixes per round (`rb-`, `tw-`, `st-`, `bt-`, `tt-`, `wl-`). Follow this in new rounds.

---

## Before Every Game Session (Checklist)

- [ ] Trivia answers filled in with real Veronica facts?
- [ ] Firebase project is live? Check the console for connection errors.
- [ ] All devices on the same WiFi network (Firebase needs internet)?
- [ ] Host has locked in their name before clicking START GAME?
- [ ] Both players scanned/opened their player URLs?
- [ ] Master Controls drawer tested (slide up from bottom on host)?
