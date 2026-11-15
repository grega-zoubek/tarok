# Tarok

Cross-platform Slovenian Tarok game platform. The project is a pnpm monorepo with a
pure TypeScript game engine at its core, heuristic bots, and a React/Vite web client.

## Packages

- **Engine (`packages/engine`)** — authoritative rules, phases, validation and scoring.
  Pure TypeScript with no browser, React, Node.js, or network dependencies.
  Exposes a single reducer (`applyAction`), seeded RNG/deal, replay-friendly state and
  zero-sum settlement (`settleGame`).
- **AI (`packages/ai`)** — random and heuristic bots built on the engine API. Bots accept
  an injectable RNG so simulations and tests are deterministic.
- **Web (`packages/web`)** — React + Vite client for the card table. The human plays seat 0
  against three configurable bots; the full game state, radlci and seed are persisted in
  `sessionStorage`, so a reload resumes the current round.
- **Server / i18n (future)** — authoritative multiplayer sessions and additional
  presentation languages. Engine strings are already kept out of UI text.

## Development

Requires Node.js 20.19+ (Vite 7) and pnpm 9.

```bash
pnpm install
pnpm dev        # builds engine + AI, then starts the Vite dev server
pnpm test       # engine, AI and web tests
pnpm typecheck  # all packages
pnpm lint       # ESLint (flat config)
pnpm build      # engine, AI and production web build
```

`pnpm dev` prebuilds the workspace packages because the web app resolves
`@tarok/engine` and `@tarok/ai` from their `dist/` outputs.

## Rules implemented

- Bidding: `tri`, `dve`, `ena`, solo variants, `solo_brez`, `berac`, `odprti_berac`,
  `barvni_valat`, `valat`, and `klop` when everyone passes.
- Called-king partnership, including the forced talon group when the called king is in
  the talon (declarer plays alone).
- Talon exchange with legal-discard validation, announcements (trula, kralji,
  pagat/kralj ultimo, valat) starting with the declarer, and trick play with
  follow-suit/tarok rules and klop overtaking/pagat protection.
- Scoring per the public rules: contract values, razlika rounded to 5, bonuses,
  radlci (declarer-only doubling, reset on win), klop per-player doubling, and
  mondfang (−21 to the loser, never doubled). Settlement is zero-sum except mondfang.
- "Brez taroka ni taroka": the web client redeals deterministically (seed is recorded and
  displayed) until every player holds at least one tarok.

## Deck summary

- **54 cards total**
- **22 taroks**: Pagat (I), II–XX, Mond (XXI), and Škis (unnumbered, highest)
- **32 suit cards**: 4 suits × 8 ranks
- **Trula**: Pagat, Mond, Škis
