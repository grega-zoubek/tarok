# Tarok

Spletna igra **slovenskega taroka** (pnpm monorepo). Jezik vmesnika: slovenščina.

Podrobnosti obsega in **izjema glede štetja** so v [`SCOPE.md`](./SCOPE.md).

## Arhitektura

- **`packages/engine`** — pravila, stanje, validacija (čisti TypeScript)
- **`packages/ai`** — hevristični boti (težavnost 1–5)
- **`packages/web`** — React + Vite odjemalec (miza, licitacija, napovedi, rezultati)

## Zagon

```bash
pnpm install
pnpm --filter @tarok/engine build
pnpm --filter @tarok/ai build
pnpm --filter @tarok/web dev
```

Testi in tipski preverjanje:

```bash
pnpm test
pnpm typecheck
```

## Karte

- **54** kart skupaj
- **22** tarokov: Pagat (I), II–XX, Mond (XXI), Škis (najvišji)
- **32** barvnih: 4 barve × 8 rangov
- **Trula**: Pagat, Mond, Škis

Obrazi kart uporabljajo javnodomenjske skene vzorca **Industrie und Glück**
(Modiano / Študentski servis Maribor) — glej
[`packages/web/public/cards/ATTRIBUTION.md`](packages/web/public/cards/ATTRIBUTION.md).
