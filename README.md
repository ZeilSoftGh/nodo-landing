# nodo — Astro core

Technical core and Instagram-derived visual foundation for NODO, a
premium/experiential bar website. The current home is a static style specimen,
not the final production experience.

## Stack

- Astro (main framework)
- React Islands
- TypeScript (strict)
- Tailwind CSS 4
- GSAP
- Lenis
- Three.js
- React Three Fiber
- Drei
- Playwright (E2E)

## Architecture

- **static-first**: public marketing/content pages prerender with
  `export const prerender = true`.
- **SSR-ready**: `output: 'server'` with the Node standalone adapter; SSR is
  opt-in per route (e.g. `/api/*`). Static HTML whenever possible, SSR only for
  a functional reason.
- **islands architecture**: React only for components that need state,
  interaction or WebGL. No React in `BaseLayout`, no global client router.
- **progressive enhancement**: the home works without JavaScript; no global
  imports of GSAP/Lenis/Three/R3F anywhere. Three.js lives only inside islands.
- **Instagram-derived styling**: `src/styles/tokens.css` and the home specimen
  use NODO's deep-green, aged-gold, tactile editorial language from Instagram.
  Fudo is explicitly excluded as a visual reference.

## Commands

```bash
pnpm dev        # dev server
pnpm build      # production build
pnpm preview    # serve the production build
pnpm check      # astro check (TypeScript strict + diagnostics)
pnpm lint       # eslint (flat config)
pnpm format     # prettier write
pnpm test:e2e   # builds + runs Playwright against the production build
pnpm test:e2e:ui # Playwright UI mode; requires a prior pnpm build (the webServer starts node ./dist/server/entry.mjs)
pnpm validate   # check + lint + format:check + build
```

## Important decisions

- Astro is the main framework. React is used only for islands. Static routes
  are preferred; SSR is opt-in according to functionality. Three.js is never
  global.
- **create-astro flag equivalence (D1)**: the spec flags (`--typescript
strict --install false --git false`) are obsolete in create-astro v5.2.4;
  the actual scaffold used `pnpm create astro@latest . --template minimal
--no-install --no-git --no-ai` (the `astro/tsconfigs/strict` tsconfig
  already comes by default in the current minimal template).
- **TypeScript 6.0.3 is intentionally pinned. Upgrade to TypeScript 7 only
  after Astro tooling and typescript-eslint officially support it.**
- `SITE_URL`: Astro does **not** load `.env` files inside `astro.config.ts`.
  The value comes from `process.env.SITE_URL` (a real environment variable of
  the process) and falls back to `http://localhost:4321` for local work. In
  production, inject `SITE_URL` as a real process environment variable.
- **pnpm settings live in `pnpm-workspace.yaml`** (pnpm ≥ 11 no longer reads
  settings from the `pnpm` field of `package.json`, and `.npmrc` only carries
  auth/registry). `saveExact` and `engineStrict` are set there; `.npmrc` keeps
  the legacy lines for non-pnpm tooling only.
- **Peer-dependency exception (documented override)**:
  `eslint-plugin-jsx-a11y@6.10.2` declares `eslint < 10` as its peer range, but
  works correctly under `eslint@10.10.0` (verified in the first lint run).
  Suppressed with a scoped entry in `peerDependencyRules.allowedVersions`
  (`"eslint-plugin-jsx-a11y>eslint": "^10"` in `pnpm-workspace.yaml`), not with
  a global rule. Allowed per spec §52.4.
- **`@types/node@24.13.3`** (D4): matches the runtime (Node 24) instead of the
  latest 26.x typings, which would not correspond to the executing engine.
- **esbuild build script approved** via `allowBuilds: { esbuild: true }` in
  `pnpm-workspace.yaml`. pnpm 12 blocks dependency build scripts by default
  (`strictDepBuilds`); esbuild's install script is required for correct
  platform-binary linking.
- **`minimumReleaseAgeExclude`** entries for the pinned
  `typescript-eslint@8.70.0` packages were auto-added by pnpm 12's supply-chain
  policy so the frozen (slightly younger) versions can be installed.
- **robots.txt is fail-closed** (D8): `src/pages/robots.txt.ts` is a runtime
  SSR endpoint that reads `PUBLIC_INDEXABLE` from `process.env`. Any value
  other than the exact string `true` serves `Disallow: /`, so a reused staging
  build can never become accidentally indexable. When indexable, it advertises
  `<SITE>/sitemap-index.xml`.
- **CSP is active** (`security: { csp: true }`) but Astro only emits it on
  build + preview, never in `dev`. Validate CSP against `pnpm preview`, not the
  dev server. No `unsafe-inline`/`unsafe-eval`; `set:html` is used only for
  internally generated JSON-LD.
- **E2E webServer uses the node entry directly** (fallback D13):
  `node ./dist/server/entry.mjs` with `HOST=127.0.0.1`/`PORT=4321`. In
  non-interactive sessions `astro preview` auto-daemonizes and detaches, which
  hangs Playwright's webServer lifecycle. For interactive use, `pnpm preview`
  works normally.
- No CMS, analytics, or reservations are integrated yet. The home currently
  demonstrates the NODO visual standard and remains static-first.
