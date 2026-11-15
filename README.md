# Tarok

Spletna igra **slovenskega taroka** (pnpm monorepo). Jezik vmesnika: slovenščina.

Podrobnosti obsega in **izjema glede štetja** so v [`SCOPE.md`](./SCOPE.md).

## Arhitektura

- **`packages/engine`** — pravila, stanje, validacija in obračun (čisti TypeScript); enoten reducer `applyAction` in obračun `settleGame`
- **`packages/ai`** — hevristični boti (težavnost 1–5) z vstavljivim RNG za deterministične simulacije
- **`packages/web`** — React + Vite odjemalec (miza, licitacija, napovedi, rezultati); stanje igre se hrani v `sessionStorage`, zato osvežitev strani nadaljuje tekoči krog

## Zagon

Potrebuješ Node.js 20.19+ (Vite 7) in pnpm 9.

```bash
pnpm install
pnpm dev        # zgradi engine + AI in zažene Vite razvojni strežnik
```

Testi, tipsko preverjanje, lint in produkcijska gradnja:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

`pnpm dev` najprej zgradi paketa, ker spletna aplikacija uporablja
`@tarok/engine` in `@tarok/ai` iz njunih map `dist/`.

## Karte

- **54** kart skupaj
- **22** tarokov: Pagat (I), II–XX, Mond (XXI), Škis (najvišji)
- **32** barvnih: 4 barve × 8 rangov
- **Trula**: Pagat, Mond, Škis

Obrazi kart uporabljajo javnodomenjske skene vzorca **Industrie und Glück**
(Modiano / Študentski servis Maribor) — glej
[`packages/web/public/cards/ATTRIBUTION.md`](packages/web/public/cards/ATTRIBUTION.md).
