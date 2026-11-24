# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/zzlau777/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/zzlau777/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar (model radar-2): every pre-token protocol in the sealed DefiLlama snapshot, ranked by the implied value of its launch — priced off the market-cap-per-TVL the live tokens in its own category actually trade at — with a six-step farm plan for each one.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
```

The snapshot comes from the competition kit (`token-radar-01-kit/input/snapshot.json`). The program needs Node 22.18 or later and nothing else: it reads the snapshot, writes the ranked board to `out/board.json`, the dashboard data to `out/data.js`, copies `dashboard/` and `screenshots/` to `out/`, and writes `out/dossier.json`.

## How the value is priced

```
implied = TVL × category multiple × (1 + clamp(7d, −50%, +100%) × 0.6) × (0.7 + min(age, 1460d) / 1460 × 0.3) × (1 + 0.02 × min(chains − 1, 5))
```

The multiple is the category's median market-cap-per-TVL among protocols whose token already trades, shrunk toward the global median when the category has few live names, clamped to 0.05x–2.00x. No name is special-cased: the same function scores every row. The board covers all 40 watchlist protocols plus every other launchable pre-token protocol in the snapshot (198 rows); wrapped, staked, bridged and exchange products are set aside with their reasons, and the 24 biggest live tokens are shown at the market's own value.

---

<sub>Entered on [make.fun](https://make.fun/?ref=nb2670a0&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
