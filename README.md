# Tarok

Cross-platform Slovenian Tarok game platform. The project is built incrementally as a pnpm monorepo with a pure TypeScript game engine at its core.

## Architecture

The codebase is organized in layers. Each layer has a single responsibility and depends inward toward the engine:

- **Engine (`packages/engine`)** — authoritative game rules, state, and validation. Pure TypeScript with no browser, React, Node.js, or network dependencies.
- **AI (future)** — bot decision-making built on top of the engine API.
- **Server (future)** — authoritative multiplayer sessions, networking, and scaling.
- **Web (future)** — React + Vite client for the card-table experience.
- **i18n (future)** — Slovenian, English, and German presentation strings kept out of the engine.

The engine uses injectable randomness so shuffling and dealing are deterministic in tests. Catalog integrity is enforced through explicit validation functions and the test suite, not import-time side effects.

## Phase 1 scope

The current engine foundation includes:

- the 54-card Slovenian Tarok deck model
- 22 explicit taroks, including Pagat (Tarok I), Mond (Tarok XXI), and Škis as a distinct highest trump
- 32 explicit suit cards
- Trula helpers and tarok strength ordering
- shuffle and four-player deal (4 × 12 hands + 6-card talon)

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
```

## Deck summary

- **54 cards total**
- **22 taroks**: Pagat (I), II–XX, Mond (XXI), and Škis (unnumbered, highest)
- **32 suit cards**: 4 suits × 8 ranks
- **Trula**: Pagat, Mond, Škis
