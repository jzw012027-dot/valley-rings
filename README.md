# valley-rings

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/jzw012027-dot/valley-rings/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/jzw012027-dot/valley-rings/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Valley Rings** — a chase-view flight game in plain Canvas JavaScript, no engine, no assets, no network. You fly a little prop plane down a winding river valley: patchwork fields, a dirt road, farmhouses and tree lines roll past below, mountains close in on both flanks, and a course of glowing rings hangs in the air ahead. Thread a ring to score, chain rings to build a combo multiplier, manage your throttle — and don't meet a hillside.

Everything is drawn and synthesised at run time: the terrain is a seeded low-poly valley (the same seed always builds the same world), the HUD carries altitude, airspeed, vertical speed, a compass tape, an artificial horizon and a throttle gauge, and the engine, wind, ring chimes and crash are WebAudio synthesis. Title screen, pause, game over and restart included.

**Controls** — ←/→ or A/D bank · ↑/↓ climb and dive · W/S or mouse wheel throttle · mouse or touch-drag steers · Enter/click starts · P pauses · M mutes.

## Run it

```sh
node serve.ts          # serves game/ at http://localhost:8080
# or hand the entry in (Node 22):
MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots under `screenshots/` are real renders of this code, frozen by the game's own shot mode (`game/?shot=play&seed=7`, see `shots.json`).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
