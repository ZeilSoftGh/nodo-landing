# Plan de implementación — Bootstrap técnico Core Astro

- **Fecha**: 2026-09-08
- **Estado**: listo para `developer`
- **Fuente de verdad técnica**: `Bootstrap técnico — Core Astro.md` (2275 líneas; referencias `§N` en este plan apuntan a sus secciones)
- **Entradas incorporadas**: brief de versiones congeladas del researcher (verificado) + verificación propia de docs oficiales pnpm 12.x + decisiones C1–C4 del orquestador
- **Prohibido**: implementar por encima de este plan, contenido/diseño final, demo visual (§59)

---

## Task Contract

- **objective**: Proyecto Astro bootstrap production-ready (SSR-ready, static-first, islands, SEO, a11y, E2E) que pasa el DoD completo de §60, con ~30 archivos mecánicos, sin contenido ni diseño final.
- **success_criteria**: Todos los comandos de la sección "Plan de validación" en verde; checklist DoD §60 completo con mapeo a tareas; entrega §62 con 12 puntos de evidencia.
- **non_goals**: git init, contenido/diseño final, demo visual, Vitest, CI, deploy, CMS/analytics/reservas, ClientRouter, dependencias prohibidas (§8, §48–50), `@react-three/postprocessing`/`rapier`/`leva`, `@astrojs/tailwind`, `tailwind.config`.
- **assumptions**: Node 24.16.0 + pnpm 12.3.4 ya instalados y verificados; sin repo git (no hacer `git init`); versiones congeladas del researcher son correctas e instalables entre sí.
- **open_questions**: none.
- **accepted_tradeoffs**: pin TS 6.0.3 (C-decisión, §4 doc); `@types/node` 24.13.3 en vez de 26.x (C4); `peerDependencyRules.allowedVersions` documentado como excepción para "cero peer warnings" (§52.4 lo permite).
- **validation**: comandos de la sección "Plan de validación" (Windows/pnpm), en orden.
- **ask_abort_triggers**: si `pnpm install` reporta peer warnings que no se resuelven con entradas scoped documentadas; si eslint-plugin-jsx-a11y no funciona bajo eslint 10 en el primer lint; si `astro check`/`build` fallan por incompatibilidad real entre las versiones congeladas; si `astro preview` no sirve el sitio (usar fallback D13 y, si también falla, escalar).

---

## 1. Contexto

Proyecto vacío (solo el doc spec) en `C:\Users\Emii\Documents\ZeilSoft\nodo`. Objetivo: bootstrap técnico completo de un sitio premium/experiencial de bar: Astro primero, static-first + SSR-ready con adapter Node, islands React, Tailwind 4, GSAP/Lenis/Three/R3F/Drei instalados pero **no** usados en la home, SEO base, a11y base, ESLint/Prettier/astro-check, Playwright E2E contra build de producción.

Entorno verificado: Windows, Node v24.16.0, pnpm 12.3.4. Sin git (no hacer `git init`; crear `.gitignore` igualmente, §46).

---

## 2. Decisiones técnicas (obligatorias, no opciones)

| # | Decisión |
|---|----------|
| **D1** (C1) | Scaffold: `pnpm create astro@latest . --template minimal --no-install --no-git --no-ai`. Los flags de §5 del doc están obsoletos; el tsconfig strict viene de serie con el template minimal actual. Si algún flag fuera rechazado, consultar `pnpm create astro@latest --help` y lograr el mismo resultado (minimal, strict, sin install, sin git) — cláusula de fallback del propio §5. |
| **D2** (C2) | `astro.config.ts` mantiene `const site = process.env.SITE_URL ?? 'http://localhost:4321';`. Documentar en README: Astro **no** carga `.env` dentro de `astro.config`; en producción `SITE_URL` se inyecta como variable de entorno real del proceso. |
| **D3** (C3, **enmienda**) | Para "cero peer warnings" (§53/§60): `eslint-plugin-jsx-a11y@6.10.2` no declara eslint 10 en su rango de peers. **Corrección sobre C3**: pnpm ≥11 ya **no** lee settings del campo `pnpm` de `package.json` ni de `.npmrc` (docs oficiales pnpm 12.x: *"Since v11, pnpm no longer reads settings from the `pnpm` field of `package.json`"*; *.npmrc* solo lee auth/registry). La ubicación vigente y efectiva es **`pnpm-workspace.yaml`**: ver T1.5. Sintaxis exacta verificada en docs pnpm 12.x (`/settings/peer-dependencies`): la forma scoped `"eslint-plugin-jsx-a11y>eslint": "^10"` suprime solo el warning de eslint como peer de jsx-a11y (más segura que la clave global `eslint:`). El desarrollador verificará que jsx-a11y funcione bajo eslint 10 en el primer lint (T6.3). Documentar como override excepcional en README (§52.4 lo permite). |
| **D4** (C4) | `@types/node@24.13.3` (match con runtime Node 24) en lugar de `@types/node@latest` (26.x). Desviación consciente documentada en README. |
| **D5** | TypeScript **pinned** a `6.0.3` exacto (§4): TS 7.0.2 rompe peers de `@astrojs/check@0.9.10` y `typescript-eslint@8.70.0`. Comentario literal en README: *"TypeScript 6.0.3 is intentionally pinned. Upgrade to TypeScript 7 only after Astro tooling and typescript-eslint officially support it."* |
| **D6** (**enmienda §34**) | `.npmrc` con `save-exact=true`/`engine-strict=true` (§34) es config muerta en pnpm 12 (solo lee auth/registry de `.npmrc`). Se crean **ambos**: `pnpm-workspace.yaml` con los settings **efectivos** (`saveExact: true`, `engineStrict: true`, `peerDependencyRules`) y `.npmrc` conservando las líneas legacy con comentario aclaratorio (satisface la existencia del archivo en §11/§34). Documentado en README. |
| **D7** | ESLint flat ESM (`eslint.config.mjs`) con spread clásico: `js.configs.recommended`, `...tseslint.configs.recommended`, `...astro.configs.recommended` (v3, flat nativo, ESM-only), `reactHooks.configs.flat.recommended` (v7, flat nativo), y bloque `files: ['**/*.tsx']` con `...jsxA11y.flatConfigs.recommended` (v6.10: el preset no define `files`) + `languageOptions.globals` de `globals.browser`. `ignores`: `dist/**`, `.astro/**`, `node_modules/**`, `playwright-report/**`, `test-results/**`. **jsx-a11y para `.astro`**: añadir `...astro.configs['jsx-a11y-recommended']` si el export existe en `eslint-plugin-astro@3.1.0` (refuerza §31/§39); si el export no existe, omitir y documentar en la entrega. Prohibido desactivar reglas importantes para lograr cero warnings (§31). |
| **D8** | `robots.txt.ts` (§16) lee `PUBLIC_INDEXABLE` de **`process.env` en runtime** (endpoint SSR, sin prerender) con **fail-closed**: si la variable falta o no es `true` → `Disallow: /`. Esto evita indexación accidental en staging aunque el build se reutilice. La URL del sitemap deriva de `import.meta.env.SITE` (valor `site` de la config). |
| **D9** | Método concreto de inspección de bundle (§58): greps sobre `dist\client\_astro\*.js` y `dist\client\index.html` (comandos en T6.11). Criterio: `index.html` de la home no referencia ningún `<script type="module">` de `/_astro/` y ningún chunk contiene huellas de `react-dom`/`useState`/`createContext`/`gsap`/`lenis`/`three`. Falsos positivos posibles por minificación → investigar causa antes de dar por bueno. |
| **D10** | Validación "HTML sin JS" (§57): DevTools con JavaScript deshabilitado **o** sesión Playwright con `javaScriptEnabled: false`; evidencia: `h1` y texto principal visibles. Manual documentado es suficiente. |
| **D11** | Sitemap (§17): `sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/api') })` sobre la config del §9. |
| **D12** | Smoke E2E (§37): home (200, `lang="es-AR"`, title, meta description, canonical, meta robots, h1, **cero** errores de consola y `pageerror`), `/api/health` (200 + `{"status":"ok"}`), `/robots.txt` (200 + contiene `User-agent`), y **se añade** `/404-test` → status 404 (barato y acredita DoD "404 funcionando"). Proyecto único Chromium. |
| **D13** | `astro preview` es el camino primario (§36/§55). Fallback documentado si fallara con el adapter node standalone: `node ./dist/server/entry.mjs` con `HOST=127.0.0.1` y `PORT=4321`. |
| **D14** | No `git init` (decisión del orquestador). `.gitignore` se crea igualmente con el contenido exacto de §46. |
| **D15** | **No** crear `public/robots-placeholder.txt` (§11 lo marca condicional): el endpoint dinámico `src/pages/robots.txt.ts` lo hace innecesario y un `public/robots.txt` estático lo sombrearía. |

---

## 3. Reglas duras (el desarrollador no puede romperlas)

1. **Solo pnpm**. Nunca npm/yarn/bun. Único lockfile: `pnpm-lock.yaml`. Prohibido que exista `package-lock.json`, `yarn.lock` o `bun.lock`.
2. **Solo versiones estables exactas** de la tabla de F2 (nada de alpha/beta/rc/canary/next; §3). **TS 6.0.3 exacto** (D5) y **`@types/node` 24.13.3** (D4). No actualizar majors sin revisión (§3).
3. **CSP activo** (`security: { csp: true }`), sin `unsafe-inline` ni `unsafe-eval`; prohibido desactivarlo para "arreglar" algo (§9/§51). `set:html` solo para JSON-LD generado internamente (§51).
4. **Sin React en `BaseLayout`**; sin `ClientRouter` (§13/§26).
5. **Sin imports globales** de three/gsap/lenis/r3f/drei (§22/§40); `SceneCanvas.tsx` **no** se usa en la home (§21).
6. **La home funciona sin JavaScript**: sin islands ni scripts en `index.astro` (§18/§57).
7. **Sin contenido/diseño final ni demo visual** (§0/§18/§59): nada de heros, partículas, cubos 3D, cards, cocktails ficticios, lorem extenso, design tokens finales, paletas o tipografías.
8. **No instalar lo prohibido**: §8 (Framer Motion, Swiper, jQuery, Bootstrap, MUI, Chakra, shadcn, Radix, Next, Zustand, Redux, TanStack, Axios, Prisma, Supabase, Firebase, Auth.js, CMS, DB, analytics, cookies, pagos, forms, validadores), §21 (`@react-three/postprocessing`, `rapier`, `leva`), §48 (CMS), §49 (reservas), §50 (analytics/GTM/pixel), §7 (no Vitest), §10 (no `@astrojs/tailwind`, no `tailwind.config`).
9. No introducir dependencias "por si acaso"; cada dependencia con necesidad concreta (§8).
10. No tocar secretos ni credenciales; no commitear `.env*` (solo `.env.example`).

---

## 4. Versiones congeladas (fuente: researcher, instalables entre sí)

### Runtime (`pnpm add`)
| Paquete | Versión |
|---|---|
| astro | 7.3.1 |
| @astrojs/react | 6.0.5 |
| @astrojs/node | 11.1.5 |
| @astrojs/sitemap | 3.7.4 |
| react / react-dom | 19.2.8 |
| gsap | 3.15.0 |
| lenis | 1.3.26 |
| three | 0.185.1 |
| @react-three/fiber | 9.7.0 |
| @react-three/drei | 10.7.8 |
| tailwindcss / @tailwindcss/vite | 4.3.3 |

### Dev (`pnpm add -D`)
| Paquete | Versión | Nota |
|---|---|---|
| typescript | 6.0.3 | **pin obligatorio** (D5) |
| @astrojs/check | 0.9.10 | |
| @types/node | 24.13.3 | **D4** (no 26.x) |
| @types/react / @types/react-dom | 19.2.18 / 19.2.7 | |
| @types/three | 0.185.4 | |
| prettier / prettier-plugin-astro | 3.9.6 / 0.14.1 | |
| eslint / @eslint/js | 10.10.0 / 10.0.1 | |
| eslint-plugin-astro | 3.1.0 | |
| eslint-plugin-react-hooks | 7.1.1 | |
| eslint-plugin-jsx-a11y | 6.10.2 | peers eslint <10 → D3 |
| typescript-eslint | 8.70.0 | |
| globals | 17.12.0 | |
| @playwright/test | 1.63.0 | |

Con `saveExact: true` activo (D6/T1.5), estos comandos escriben pins exactos (sin `^`) en `package.json`.

---

## 5. Fases y tareas atómicas

> Cada fase termina en un estado coherente y verificable. "Aceptación" = comando o inspección concreta.

### F1 — Runtime + scaffold
*Estado final: proyecto Astro minimal en la raíz, sin `node_modules`, runtime y settings de pnpm fijados.*

- **T1.1 Scaffold** — Ejecutar D1 en la raíz del proyecto. Si un flag falla → `pnpm create astro@latest --help` y equivalente.
  - *Aceptación*: existen `package.json`, `tsconfig.json` (extends `astro/tsconfigs/strict`), `src/pages/index.astro`; NO existe `node_modules`; NO existe `.git`.
- **T1.2 Limpieza inicial del starter** — Borrar assets/ejemplos sin uso del template (p. ej. SVGs demo, código de ejemplo en `index.astro` se reescribe en F4). Conservar `public/favicon.svg`.
  - *Aceptación*: no queda código de demo del starter; `favicon.svg` presente.
- **T1.3 `.nvmrc`** — Contenido: `24.16.0` (§2).
  - *Aceptación*: archivo con esa línea exacta.
- **T1.4 `package.json` (metadata)** — `private: true`; `"engines": { "node": ">=24.16.0 <25" }`; `"packageManager": "pnpm@12.3.4"` (versión real instalada, no inventada; §35).
  - *Aceptación*: JSON válido con los tres campos; versión de pnpm coincide con `pnpm --version`.
- **T1.5 Settings de pnpm (D3/D6)** — Crear `pnpm-workspace.yaml` (sin campo `packages`: workspace de un solo paquete raíz; ubicación **efectiva** de settings en pnpm ≥11):
  ```yaml
  saveExact: true
  engineStrict: true
  peerDependencyRules:
    allowedVersions:
      "eslint-plugin-jsx-a11y>eslint": "^10"
  ```
  Crear además `.npmrc` (§34, legacy/comentado):
  ```ini
  ; pnpm >=11 lee settings de pnpm-workspace.yaml; .npmrc solo aporta auth/registry.
  ; Líneas legacy mantenidas por §34 del spec y para herramientas no-pnpm.
  save-exact=true
  engine-strict=true
  ```
  - *Aceptación*: ambos archivos existen con ese contenido.
- **T1.6 `.gitignore` (§46, D14)** — Contenido exacto: `node_modules/`, `dist/`, `.astro/`, `.env`, `.env.*`, `!.env.example`, `playwright-report/`, `test-results/`, `.DS_Store`.
  - *Aceptación*: archivo con esas líneas; sin `git init`.

### F2 — Dependencias exactas
*Estado final: lockfile generado, cero peer warnings, §53 verificado.*

- **T2.1 Runtime deps** — Comando exacto (con `saveExact` activo quedan pinned):
  ```powershell
  pnpm add astro@7.3.1 @astrojs/react@6.0.5 @astrojs/node@11.1.5 @astrojs/sitemap@3.7.4 react@19.2.8 react-dom@19.2.8 gsap@3.15.0 lenis@1.3.26 three@0.185.1 "@react-three/fiber@9.7.0" "@react-three/drei@10.7.8" tailwindcss@4.3.3 "@tailwindcss/vite@4.3.3"
  ```
  - *Aceptación*: `pnpm list astro @astrojs/react @astrojs/node react gsap lenis three "@react-three/fiber" "@react-three/drei" tailwindcss` muestra las versiones exactas de la tabla; en `package.json` no hay prefijos `^`.
- **T2.2 Dev deps** — Comando exacto:
  ```powershell
  pnpm add -D typescript@6.0.3 "@astrojs/check@0.9.10" "@types/node@24.13.3" "@types/react@19.2.18" "@types/react-dom@19.2.7" "@types/three@0.185.4" prettier@3.9.6 prettier-plugin-astro@0.14.1 eslint@10.10.0 "@eslint/js@10.0.1" eslint-plugin-astro@3.1.0 eslint-plugin-react-hooks@7.1.1 eslint-plugin-jsx-a11y@6.10.2 typescript-eslint@8.70.0 globals@17.12.0 "@playwright/test@1.63.0"
  ```
  - *Aceptación*: `pnpm list typescript` → 6.0.3 (devDeps); `@types/node` → 24.13.3; resto según tabla.
- **T2.3 Cero peer warnings (D3)** — Re-ejecutar `pnpm install` e inspeccionar salida. Si aparecen warnings de peers **distintos** del de jsx-a11y (p. ej. `eslint-plugin-astro` vs eslint 10), añadir **entradas scoped adicionales** en `peerDependencyRules.allowedVersions` (una por paquete dependiente, formato `"<paquete>><peer>": "<rango>"`), documentarlas en README y re-instalar. Prohibido `ignoreMissing` genérico o claves globales demasiado anchas.
  - *Aceptación*: salida de `pnpm install` sin warnings de "unmet peer dependency"; cualquier regla añadida está documentada en README + entrega.
- **T2.4 Verificación §53** — `pnpm list astro @astrojs/react @astrojs/node react react-dom gsap lenis three "@react-three/fiber" "@react-three/drei" tailwindcss`.
  - *Aceptación*: todos instalados; `pnpm-lock.yaml` existe y no hay otros lockfiles.

### F3 — Configuración
*Estado final: toolchain configurado; aún sin código propio (se hace en F4).*

- **T3.1 `astro.config.ts`** — Reemplazar el `.mjs` del starter por `astro.config.ts` con la forma del §9 (APIs vigentes confirmadas para Astro 7.3.1): `site` (D2), `output: 'server'`, `adapter: node({ mode: 'standalone' })`, `integrations: [react(), sitemap(<filter D11>)]`, `trailingSlash: 'never'`, `compressHTML: true`, `security: { csp: true }` (API estable; solo activa en build+preview, no en dev), `vite: { plugins: [tailwindcss()] }`.
  - *Aceptación*: inspección del archivo contiene todos los puntos anteriores, incluido el filter del sitemap; no existe `astro.config.mjs` residual.
- **T3.2 `tsconfig.json`** — Partir del strict del template (coincide con §12) y añadir solo `compilerOptions.baseUrl: "."` y `compilerOptions.paths` con los 6 aliases de §12 (`@/*`, `@components/*`, `@layouts/*`, `@lib/*`, `@styles/*`, `@assets/*`). Astro resuelve los aliases de tsconfig en Vite de forma nativa.
  - *Aceptación*: JSON válido; `extends: "astro/tsconfigs/strict"`; aliases presentes.
- **T3.3 `src/styles/global.css`** — `@import 'tailwindcss';` + la base mínima de §10 (reset box-sizing, html/body min-width 320, media display block, form hereda fuente). **Sin** paleta/tipografías/radios/sombras/escales ni design tokens finales (§10/§44).
  - *Aceptación*: contenido según §10; sin tokens de diseño finales.
- **T3.4 `eslint.config.mjs` (D7)** — Flat ESM. Shape de referencia:
  ```js
  import js from '@eslint/js';
  import globals from 'globals';
  import astro from 'eslint-plugin-astro';
  import reactHooks from 'eslint-plugin-react-hooks';
  import jsxA11y from 'eslint-plugin-jsx-a11y';
  import tseslint from 'typescript-eslint';

  export default [
    { ignores: ['dist/**', '.astro/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...astro.configs.recommended,
    reactHooks.configs.flat.recommended,
    {
      files: ['**/*.tsx'],
      ...jsxA11y.flatConfigs.recommended, // el preset no define `files`
      languageOptions: { globals: { ...globals.browser } },
    },
    // D7: añadir ...astro.configs['jsx-a11y-recommended'] si existe el export en 3.1.0;
    // si no existe, omitir y documentar.
  ];
  ```
  - *Aceptación*: archivo válido ESM; incluye todos los bloques D7; ninguna regla desactivada para "ganar".
- **T3.5 Prettier** — `.prettierrc.mjs` según §32 (plugin `prettier-plugin-astro`, `semi`, `singleQuote`, `trailingComma: 'all'`, `printWidth: 100`, override parser astro). `.prettierignore`: `dist`, `.astro`, `node_modules`, `pnpm-lock.yaml`, `playwright-report`, `test-results`.
  - *Aceptación*: ambos archivos según §32 (+ ignores extra de reportes).
- **T3.6 `.editorconfig`** — Exactamente §33 (`root`, utf-8, lf, final newline, spaces 2, trim, excepción `*.md`).
  - *Aceptación*: contenido idéntico a §33.
- **T3.7 `.env.example`** — Exactamente §16/§45: `SITE_URL=http://localhost:4321` y `PUBLIC_INDEXABLE=false`. Sin secretos ficticios.
  - *Aceptación*: dos claves presentes; sin `.env` real en el proyecto.
- **T3.8 Scripts de `package.json` (§35)** — `dev`, `start`, `build`, `preview`, `check`, `lint`, `lint:fix`, `format`, `format:check`, `test:e2e: "pnpm build && playwright test"`, `test:e2e:ui: "playwright test --ui"`, `validate: "pnpm check && pnpm lint && pnpm format:check && pnpm build"`.
  - *Aceptación*: `pnpm run` lista todos los scripts anteriores.

### F4 — Core code
*Estado final: app mínima coherente (layout, SEO, home, 404, health, robots, libs motion/seo/three, island no usada).*

- **T4.1 Estructura de carpetas (§11)** — Crear el árbol completo: `src/assets/{images,video,models,fonts}`, `src/components/{core,islands,ui}`, `src/layouts`, `src/lib/{motion,seo,three}`, `src/pages/api`, `src/styles`, `tests/e2e`, `public`. Mantener `src/env.d.ts` del template. Sin `public/robots-placeholder.txt` (D15).
  - *Aceptación*: árbol coincide con §11; `env.d.ts` existe; `robots-placeholder.txt` ausente.
- **T4.2 `src/layouts/BaseLayout.astro` (§13/§39)** — Props exactas: `{ title: string; description: string; canonical?: URL | string; image?: string; noindex?: boolean }`. `<!doctype html>`, `<html lang="es-AR">`, `<head>` con `SeoHead`, import de `global.css`, `SkipLink`, `<main id="main-content"><slot /></main>` único, estructura semántica. **Sin** React ni imports de GSAP/Lenis/Three/R3F.
  - *Aceptación*: inspección — no hay imports de react/motion/3d; `#main-content` presente; `lang="es-AR"`.
- **T4.3 `src/components/core/SeoHead.astro` (§14/§15)** — Soporta: title, description, canonical (default `new URL(Astro.url.pathname, Astro.site)`), robots (`noindex` → `noindex, nofollow`), OpenGraph completo, Twitter Cards, `og:image`, `theme-color`, y `jsonLd?: Record<string, unknown> | Record<string, unknown>[]` renderizado **server-side** (`<script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />` solo si la prop viene). Placeholders claramente identificables; sin schema/comercial falso (§14).
  - *Aceptación*: todas las metas del §14 se emiten; canonical deriva de `Astro.site`; jsonLd solo con prop; placeholders visibles en el código.
- **T4.4 `src/components/core/SkipLink.astro` (§39)** — `<a href="#main-content">` visualmente oculto hasta foco (`:focus-visible` lo muestra), apuntando al `main` del layout.
  - *Aceptación*: presente en BaseLayout; el target existe en la misma página.
- **T4.5 `src/pages/index.astro` (§18)** — `export const prerender = true;` + BaseLayout + contenido estructural mínimo (`<h1>Project Core</h1>`, `<p>Astro core initialized.</p>`) con **una** clase utilitaria Tailwind (p. ej. en un wrapper) para verificar la pipeline de CSS en F6. Sin islands, sin `<script>`, sin `client:*`.
  - *Aceptación*: `prerender = true` presente; cero `<script` y `client:` en el archivo; h1 y texto principales presentes.
- **T4.6 `src/pages/api/health.ts` (§19)** — GET → `Response.json({ status: 'ok' }, { status: 200, headers: { 'Cache-Control': 'no-store' } })`. **Sin** export de prerender (queda SSR).
  - *Aceptación*: inspección — sin `prerender`; JSON y header correctos.
- **T4.7 `src/pages/robots.txt.ts` (§16 + D8)** — Endpoint SSR (sin prerender). `process.env.PUBLIC_INDEXABLE` en runtime, **fail-closed**: `true` → `User-agent: *\nAllow: /\n\nSitemap: ${import.meta.env.SITE}/sitemap-index.xml`; cualquier otro valor → `User-agent: *\nDisallow: /`.
  - *Aceptación*: ambas ramas en el código; default cerrado; sin prerender.
- **T4.8 `src/pages/404.astro` (§38)** — Simple, `export const prerender = true;`, BaseLayout con `noindex` (prop → meta robots), sin diseño final.
  - *Aceptación*: prerender + noindex presentes; usa BaseLayout.
- **T4.9 `src/lib/motion/gsap.ts` (§23/§25)** — Centraliza GSAP: registro lazy de plugins (soporte preparado para `ScrollTrigger`), `createScrollAnimation()` que inicializa y devuelve cleanup; **ningún timeline/efecto al importar** (sin side effects top-level); chequeo `window.matchMedia('(prefers-reduced-motion: reduce)').matches` que degrada a no-op.
  - *Aceptación*: inspección — export shape create/cleanup; cero ejecución en top-level; reduced-motion chequeado.
- **T4.10 `src/lib/motion/lenis.ts` (§24/§25)** — Abstracción/fábrica para smooth scroll: **no** inicializa nada globalmente ni altera el scroll nativo; guard de `prefers-reduced-motion`; diseño para integrar ScrollTrigger y destruirse limpio (documentar constraints: anchor nav, keyboard, mobile).
  - *Aceptación*: módulo exportable sin efectos; guard presente; destroy previsto.
- **T4.11 `src/lib/seo/metadata.ts`** — Defaults tipados y claramente placeholder (site name, title/description por defecto, defaults OG/Twitter/theme-color). Sin datos comerciales reales (§14).
  - *Aceptación*: solo placeholders identificables; tipos exportados.
- **T4.12 `src/lib/three/config.ts`** — Constantes tipadas de defaults WebGL (cap de `dpr` p. ej. `[1, 2]`, antialias, toggles básicos). **Sin** importar `three` aquí (§21/§22).
  - *Aceptación*: archivo sin imports de three; constantes exportadas.
- **T4.13 `src/components/islands/SceneCanvas.tsx` (§21/§22)** — Abstracción mínima R3F: `Canvas` con `dpr` limitado (desde `@lib/three/config`), antialias razonable, wrapper responsive, `<Suspense>` con fallback accesible (contenedor con `role="img"`/`aria-label`). Importa `@react-three/fiber`, `@react-three/drei` y `three` correctamente (uso mínimo type-safe, p. ej. `AdaptiveDpr` de drei) para validar el ecosistema. **No montar modelos/luces/shaders/assets/postprocessing/física. NO usarlo en la home.**
  - *Aceptación*: `pnpm check` (F6) compila el archivo; grep confirma que `index.astro` no lo referencia.
- **T4.14 Sin JS en el bundle de la home** — Verificación estructural: ningún archivo de F4 introduces three/gsap/lenis/r3f en la ruta de la home (regla dura 5–6). La verificación de evidencia es T6.11.
  - *Aceptación*: revisión de imports de los archivos de páginas/layout/core.

### F5 — Calidad + E2E
*Estado final: suite E2E lista, README completo, chromium instalado.*

- **T5.1 `playwright.config.ts`** — Según brief (APIs vigentes): `testDir: 'tests/e2e'`; `use: { baseURL: 'http://localhost:4321/' }`; `webServer: { command: 'pnpm preview', url: 'http://localhost:4321/', timeout: 120000, reuseExistingServer: !process.env.CI }`; `trace: 'on-first-retry'`; `screenshot: 'only-on-failure'`; `video: 'on-first-retry'`; `projects`: solo Chromium. E2E contra build de producción (§36).
  - *Aceptación*: config contiene todos los puntos; un solo proyecto Chromium.
- **T5.2 `tests/e2e/smoke.spec.ts` (§37 + D12)** — Tests:
  - **Home** `GET /` → 200; `<html lang="es-AR">`; `<title>` no vacío; `meta[name="description"]`; `link[rel="canonical"]`; `meta[name="robots"]`; `h1` visible; recolectar mensajes de consola tipo `error` y eventos `pageerror` → exigir cero.
  - **Health** `GET /api/health` → 200 y JSON `{ status: 'ok' }`.
  - **Robots** `GET /robots.txt` → 200 y cuerpo contiene `User-agent`.
  - **404** `GET /404-test` → status 404 (añadido D12).
  - *Aceptación*: archivo cubre los 4 grupos; sintaxis `@playwright/test` tipada.
- **T5.3 `README.md` (§47)** — Secciones: **Stack** (Astro, React Islands, TypeScript, Tailwind, GSAP, Lenis, Three, R3F, Drei, Playwright), **Architecture** (static-first, SSR-ready, islands, progressive enhancement), **Commands** (los 8 de §47), **Important decisions** (§47 + este plan): frase literal del pin de TS (D5); nota de que `SITE_URL` se inyecta como env real en producción porque Astro no carga `.env` en `astro.config` (D2); overrides excepcionales C3 (allowedVersions scoped por peer warnings, verificado en primer lint) y C4 (`@types/node` 24.x); ubicación de settings pnpm en `pnpm-workspace.yaml` (D3/D6); robots fail-closed (D8); CSP activo solo en build+preview (no en dev). Sin documentación comercial del bar.
  - *Aceptación*: las 4 secciones existen con todos los puntos anteriores.
- **T5.4 Chromium** — `pnpm exec playwright install chromium` (§7).
  - *Aceptación*: comando exit 0.

### F6 — Validación completa
*Estado final: DoD §60 verde, evidencia §62 recolectada. Ver "Plan de validación" para el orden exacto.*

- **T6.1** `pnpm format` → luego `pnpm format:check` → exit 0.
- **T6.2** `pnpm check` → exit 0 (TypeScript strict + astro-check con TS 6.0.3).
- **T6.3** `pnpm lint` → exit 0 y **cero warnings**; primera verificación real de jsx-a11y bajo eslint 10 (D3). Si falla por el plugin → investigar ruta compatible documentada antes de tocar config; escalar si no existe (abort trigger).
- **T6.4** `pnpm build` → exit 0. **Evidencia §56**: la salida del build lista `/` y `/404` como prerendered (o equivalentemente existen `dist/client/index.html` y `dist/client/404.html`); existe `dist/client/sitemap-index.xml`. Endpoints sin export de prerender quedan SSR (§55).
- **T6.5** `pnpm test:e2e` → verde (re-build + Playwright sobre preview).
- **T6.6** `pnpm validate` → exit 0.
- **T6.7** `pnpm install --frozen-lockfile` → exit 0 (lockfile reproducible).
- **T6.8** `pnpm outdated` y `pnpm audit` ejecutados y **revisados** (§52); prohibido `pnpm audit --fix --force`; overrides no permitidos salvo D3 ya documentado. Resultados van a la entrega.
- **T6.9** `pnpm preview` + en otra terminal (`curl.exe` en PowerShell, no el alias `curl`):
  - `curl.exe -s -o NUL -w "%{http_code}" http://localhost:4321/` → `200`
  - `curl.exe -s http://localhost:4321/robots.txt` → contiene `Disallow: /`
  - `curl.exe -s http://localhost:4321/api/health` → `{"status":"ok"}` (y `Cache-Control: no-store`)
  - `curl.exe -s -o NUL -w "%{http_code}" http://localhost:4321/404-test` → `404`
  - CSP: el HTML de `/` incluye la meta CSP **sin** `unsafe-inline` ni `unsafe-eval` (§51; csp solo emite en build+preview).
  - Fallback si `astro preview` falla (D13): `node ./dist/server/entry.mjs` con `HOST=127.0.0.1`, `PORT=4321`, repetir checks.
- **T6.10** HTML sin JS (§57 + D10): bloquear JavaScript (DevTools o sesión Playwright `javaScriptEnabled: false`) sobre `/` → `h1` y texto principal siguen visibles. Evidencia documentada.
- **T6.11** Bundle check (§58 + D9):
  ```powershell
  Get-ChildItem dist\client\_astro -Filter *.js -ErrorAction SilentlyContinue
  Select-String -Path "dist\client\_astro\*.js" -Pattern "gsap|lenis|three|react-dom|createContext|useState" -ErrorAction SilentlyContinue
  Select-String -Path "dist\client\index.html" -Pattern "<script"
  ```
  - *Aceptación*: `index.html` no referencia scripts de `/_astro/`; los greps no arrojan huellas de react/gsap/lenis/three/r3f/drei (falsos positivos por minificación → investigar causa real antes de cerrar).
- **T6.12 (opcional, recomendado)** Modo indexable de robots: `$env:PUBLIC_INDEXABLE='true'` → `pnpm build` → `curl.exe http://localhost:4321/robots.txt` contiene `Sitemap:` → **revertir** env (`Remove-Item Env:PUBLIC_INDEXABLE`) y re-build. Evidencia de ambas ramas de D8.
- **T6.13** Redactar la entrega §62 (12 puntos) a partir de la evidencia recolectada. Detenerse al terminar el core (§62: no continuar con contenido/diseño).

---

## 6. Mapeo al DoD de §60

Cada ítem del checklist DoD queda cubierto así:

| Ítem DoD | Dónde |
|---|---|
| Astro latest stable instalado | T2.1 (astro 7.3.1) |
| Node 24 estandarizado | T1.3, T1.4 |
| pnpm configurado | T1.4 (`packageManager`), T1.5 (settings) |
| TypeScript strict | T1.1 (template) + T3.2 |
| TypeScript 6.0.3 fijado | T2.2, D5, README (T5.3) |
| React integration funcionando | T2.1 + compila en T6.2/T6.4 |
| Node SSR adapter funcionando | T3.1 + T6.9 (`/api/health`) |
| Sitemap configurado | T3.1 (D11) |
| Tailwind 4 funcionando | T3.1 + T3.3 + T4.5 + evidencia CSS en T6.4 |
| GSAP/Lenis/Three/R3F/Drei instalados | T2.1 |
| BaseLayout creado | T4.2 |
| SEO component creado | T4.3 |
| canonical configurado | T4.3 (`new URL(pathname, Astro.site)`) + smoke (T5.2) |
| robots.txt dinámico por environment | T4.7 + T6.9 (+ T6.12) |
| sitemap funcionando | T6.4 (`sitemap-index.xml` en dist) |
| home prerenderizada | T4.5 + T6.4 |
| /api/health SSR funcionando | T4.6 + T6.9 |
| 404 funcionando | T4.8 + T5.2 (`/404-test` 404) |
| SkipLink funcionando | T4.4 |
| reduced-motion contemplado | T4.9, T4.10 (§25) |
| ESLint funcionando | T3.4 + T6.3 |
| Prettier funcionando | T3.5 + T6.1 |
| astro check funcionando | T3.8 (`check`) + T6.2 |
| Playwright funcionando | T5.1, T5.2, T5.4 + T6.5 |
| pnpm-lock.yaml generado | T2.x |
| no peer dependency warnings | T2.3 (D3) |
| pnpm audit revisado | T6.8 |
| pnpm check/lint/format:check/build/test:e2e pasan | T6.1–T6.6 |
| home funciona sin JavaScript | T4.5 + T6.10 |
| Three.js no entra en home bundle | T4.13/T4.14 + T6.11 |
| React no entra en home bundle sin necesidad | T6.11 |
| README actualizado | T5.3 |
| no contenido final agregado / no diseño final | T4.5, T3.3, regla dura 7 |

---

## 7. Plan de validación (orden exacto — Windows / PowerShell / pnpm)

```powershell
# tras F5 completo:
pnpm format
pnpm format:check        # exit 0
pnpm check               # exit 0
pnpm lint                # exit 0, cero warnings
pnpm build               # exit 0; nota prerender de / y /404 en la salida
pnpm test:e2e            # verde
pnpm validate            # exit 0
pnpm install --frozen-lockfile   # exit 0
pnpm outdated            # revisar (no actualizar)
pnpm audit               # revisar (prohibido --fix --force)

pnpm preview             # terminal 1 (fallback D13 si fallara)
# terminal 2:
curl.exe -s -o NUL -w "%{http_code}" http://localhost:4321/          # 200
curl.exe -s http://localhost:4321/robots.txt                          # Disallow: /
curl.exe -s http://localhost:4321/api/health                          # {"status":"ok"}
curl.exe -s -o NUL -w "%{http_code}" http://localhost:4321/404-test   # 404
# CSP meta sin unsafe-inline/eval en el HTML de /

# bundle check (T6.11) + no-JS check (T6.10) + opcional T6.12
```

**Evidencia para la entrega §62 (12 puntos)**:
1. Versiones instaladas → salida de T2.1/T2.2 (`pnpm list`).
2. Archivos creados → árbol final según T4.1 + configs.
3. Decisiones tomadas → D1–D15 + desviaciones (flags scaffold, `pnpm-workspace.yaml`, `@types/node`).
4–7. Resultados de `pnpm check` / `lint` / `build` / `test:e2e` → capturas o salida de T6.2–T6.5.
8. `pnpm audit` → salida de T6.8.
9. Confirmación SSR `/api/health` → T6.9.
10. Confirmación prerender `/` → salida de T6.4 / presencia de `dist/client/index.html`.
11. Warnings pendientes → de T6.3/T6.8 (debe ser "ninguno" o documentado).
12. Cambios respecto del doc por incompatibilidades reales → D1–D15, especialmente D3/D6 (ubicación de settings pnpm), D4, D5, D8, D15.

---

## 8. Riesgos y notas

| Riesgo | Mitigación |
|---|---|
| `eslint-plugin-jsx-a11y@6.10.2` bajo eslint 10: peers fuera de rango (resuelto con D3) y comportamiento runtime sin verificar | T6.3 es la verificación en el primer lint; abort trigger si no hay ruta compatible |
| Aparezcan peer warnings **adicionales** con eslint 10 (p. ej. `eslint-plugin-astro`) | T2.3: añadir entradas scoped una a una, documentadas; nunca claves globales anchas |
| C3 original (campo `pnpm` en package.json) es inerte en pnpm 12 | D3: ubicación efectiva en `pnpm-workspace.yaml` (verificado en docs oficiales 12.x) |
| `save-exact`/`engine-strict` en `.npmrc` son inerte en pnpm 12 | D6: settings efectivos en `pnpm-workspace.yaml`; `.npmrc` queda legacy/comentado |
| CSP solo verificable en build+preview (no en dev) | T6.9 valida la meta CSP contra `pnpm preview`; documentado en README |
| `astro preview` pudiera fallar con adapter node standalone | Fallback D13: `node ./dist/server/entry.mjs` con `HOST`/`PORT` |
| Flags de `create-astro` pueden haber cambiado | D1: fallback a `pnpm create astro@latest --help` (cláusula §5) |
| Falsos positivos del grep de bundle (nombres minificados) | D9: investigar causa real de cualquier match antes de cerrar T6.11 |
| `astro.config` no carga `.env` | D2: `SITE_URL` como env real en producción; default localhost para dev/validación |
| `pnpm-workspace.yaml` convierte el proyecto en workspace de paquete único | Comportamiento documentado y soportado (root incluido por defecto); sin impacto funcional |
| Chromium de Playwright requiere descarga | T5.4 explícito; red puede tardar |
| Tentación de "demo visual" o dependencias extra | Reglas duras 7 y 9; §59 |

---

## 9. Non-goals (explícitos)

- No `git init`; solo `.gitignore` (D14).
- No implementar el sitio ni contenido real (§0): la home es placeholder estructural.
- No Vitest (§7), no CI, no deploy, no CMS/analytics/reservas (§48–50).
- No `ClientRouter`/View Transitions (§26).
- No `@astrojs/tailwind`, no `tailwind.config` (§10).
- No postprocessing/rapier/leva ni assets 3D (§21/§29).
- No design tokens finales, paleta, tipografías (§10/§44).
- No tocar `docs/ai/**` ni el doc spec fuente.
