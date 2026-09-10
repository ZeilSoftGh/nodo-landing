# NODO Fase 01 — Diseño de implementación (orquestación)

- **Fecha**: 2026-09-09
- **Estado**: aprobado por el usuario → listo para `specifier`
- **Producto — fuente de verdad**: `docs/NODO — Home Experience - Fase 01.md` (2304 líneas; referencias `§N` apuntan a sus secciones)
- **Identidad**: `docs/nodo-brand-scrape.md` (ya vertida en `src/styles/tokens.css`)
- **Investigación**: handoff del `researcher` del 2026-09-09 (R1–R7 verificados, 5 correcciones técnicas incorporadas)

---

## 1. Objetivo

Implementar la primera secuencia real de la landing de NODO Cóctel Bar: intro "Bienvenido a la experiencia NODO" con el reloj como objeto protagonista, transición reversible hacia una escena de video controlada por scroll, migración del specimen a `/styleguide`, wiring inicial real de GSAP/Lenis y suite de tests Playwright.

Todo el comportamiento visual, tipográfico y de interacción está definido por el doc de Fase 01. Este documento registra las decisiones técnicas validadas y el plan de orquestación; no redefine el producto.

## 2. Alcance

**Incluye**: `ExperienceIntro.astro`, `ScrollFilm.astro`, `lib/motion/homeExperience.ts`, extensiones de `lib/motion/gsap.ts` y `lenis.ts`, `pages/index.astro` (compositor), `pages/styleguide.astro` (specimen movido + noindex), tests Playwright de §58, validación completa.

**Fuera de alcance (§54 + bootstrap)**: Three.js/WebGL, cocktails/cards/menu/reservas/about/footer complejo, NODOFESTA como página, self-hosting de fuentes, compresión de `reloj.png`, commits de features no pedidas, video real (queda pendiente; su ausencia no debe romper nada, §57).

## 3. Flujo de orquestación (enfoque B aprobado)

1. ~~`researcher`~~ — completado (ver §4).
2. `specifier` → `docs/ai/plans/2026-09-09-nodo-fase-01-plan.md` (tareas atómicas + Task Contract + validación, formato del plan de bootstrap).
3. `developer` → implementación por fases con validación por fase.
4. `reviewer` → envelope canónico `review_stage: final` sobre el diff.
5. Commit del feature → solo con aprobación explícita del usuario.

## 4. Hallazgos del researcher (base de las decisiones)

- **R1 CONFIRMED**: timeline/tween + `scrollTrigger: { scrub: true }` es el patrón válido; cleanup propio (kill de timeline y de SUS triggers) es correcto; el patrón del doc §30 es válido con `scrub: true`; ScrollTrigger ya sincroniza con el ticker → no hace falta loop rAF propio para `video.currentTime`; añadir guard anti-writes redundantes.
- **R2 CONFIRMED + correcciones**: receta oficial Lenis+ScrollTrigger es `lenis.on('scroll', ScrollTrigger.update)` + `gsap.ticker.add((time) => lenis.raf(time * 1000))` + `gsap.ticker.lagSmoothing(0)`; la opción vigente es **`syncTouch`** (default off → mobile nativo), no `smoothTouch`; **falta importar `lenis/dist/lenis.css`** en el repo; `respectReducedMotion` default true; usar `anchors: true` para no romper anclas.
- **R3 CONFIRMED**: `<script>` por defecto en .astro = bundled + hoisted + dedupe, corre tras parsear el DOM (querySelector seguro); patrón oficial `data-*` + `dataset`; sin ClientRouter `astro:before-swap` nunca dispara → cleanup a nivel de carga de página (corrección al §38).
- **R4 CONFIRMED**: `preload` es hint, no garantía; el upgrade runtime metadata→auto solo es fiable vía `video.load()` (costo: reinicia fetch) → tratarlo como best-effort (§35 ya lo condiciona); `duration` es NaN hasta `loadedmetadata` (guard obligatorio); `error` dispara ante src inexistente → fallback silencioso; `muted`/`playsinline` no afectan al scrub (nunca se llama `play()`), se mantienen.
- **R5 CONFIRMED**: `page.emulateMedia({ reducedMotion: 'reduce' })` y `browser.newContext({ javaScriptEnabled: false })` vigentes en Playwright 1.63; asertar estados DOM/geometría (computed style, `expect.poll`), no frames visuales.
- **R6 CONFIRMED**: fuentes no self-hosteadas; usar fallbacks de sistema de `tokens.css`; ninguna dependencia de fuentes nueva.
- **R7 VERIFICADO**: `public/reloj.png` = **1672×941 px, ~1.35 MB (no cuadrado, ~16:9)** → `width`/`height` explícitos, dimensionar por `width` con `aspect-ratio: 1672/941`; el reloj es una subregión del lienzo del asset, no un círculo perfecto.

Hallazgo estructural: `createScrollAnimation`, `createSmoothScroll` y `lenis.css` no se usan en ningún lugar → Fase 01 es el primer wiring real de ambas librerías.

## 5. Decisiones técnicas (obligatorias)

| # | Decisión |
|---|----------|
| D1 | Escena = CSS sticky (`100svh`) + una timeline GSAP con `scrub: true` por escena (§11/§61). Dos timelines en total: IntroTimeline y FilmTimeline. Progresión de fases 0→100% según §22. |
| D2 | Wiring real de motion libs: `gsap.ts` se extiende con `getScrollTrigger()` lazy (§36) sin romper su filosofía actual (lazy + reduced-motion + cleanup); `lenis.ts` integra la receta oficial R2, importa `lenis/dist/lenis.css` y expone la integración para la home. `anchors: true`. Touch nativo: no activar `syncTouch`. |
| D3 | Estados ocultos iniciales SOLO vía `gsap.set()` tras confirmar JS (§44): la página debe verse completa sin JS. Cleanup a nivel de carga de página (guardar referencias propias; nunca `ScrollTrigger.getAll()`, §38). |
| D4 | Video: `<video muted playsinline preload="metadata" aria-hidden="true">` sin src inicial; ruta convencional futura `/video/nodo-experience.mp4`; guards `loadedmetadata`/`error`; upgrade de preload best-effort (R4); fallback visual NODO conectado con el hero (§27). Sin fake MP4 ni placeholder visible. |
| D5 | Reloj: `<img src="/reloj.png" width="1672" height="941" fetchpriority="high" decoding="async" alt="" aria-hidden="true">`, capa independiente (§16), escala por `width` con clamp (§17) y `aspect-ratio` preservado. LCP: sin `loading="lazy"` (§45). |
| D6 | Tipografía: sin cambios (§4). `--font-display` para el H1, `--font-sans` para metadata/UI. Dorado como joyería: poco y con intención (§15). |
| D7 | `index.astro` actual (specimen) se mueve a `pages/styleguide.astro` con `noindex` (§9); el nuevo `index.astro` es compositor de secciones (§10) con `prerender = true`, H1 semántico único "Bienvenido a la experiencia NODO", SEO provisional (§48). |
| D8 | Reduced motion: entrada sin gran animación, sin scrub cinematográfico fuerte, sin escritura de `currentTime`; degradar a hero normal + film/fallback normal (§43). |
| D9 | Mobile: scroll nativo o cercano, sin scroll-jacking; recorrido menor (intro ~170–190svh, film ~220–280svh; desktop 220svh/350svh) (§40/§41); `svh`/`dvh` (§42). |
| D10 | Tests Playwright nuevos (`tests/e2e/home-experience.spec.ts`) cubriendo los 7 tests de §58 + validación `pnpm validate` + `pnpm test:e2e`. Asertos de estado DOM. |

## 6. Arquitectura de archivos

```
src/
├── components/home/
│   ├── ExperienceIntro.astro      (nuevo — hero + reloj + H1)
│   └── ScrollFilm.astro           (nuevo — escena video + overlay + fallback)
├── lib/motion/
│   ├── gsap.ts                    (extendido — getScrollTrigger lazy)
│   ├── lenis.ts                   (integración ScrollTrigger + lenis.css)
│   └── homeExperience.ts          (nuevo — init/cleanup de ambas escenas, resize, reduced-motion)
├── pages/
│   ├── index.astro                (compositor: BaseLayout + ExperienceIntro + ScrollFilm)
│   └── styleguide.astro           (specimen movido, noindex)
tests/e2e/home-experience.spec.ts  (nuevo — 7 tests §58)
```

## 7. Accesibilidad y robustez

- H1 semántico único en HTML; texto nunca en canvas/imagen (§13).
- Reloj decorativo `alt=""` + `aria-hidden`; video ambiental `aria-hidden` sin controles (§49).
- Skip link y focus visible existentes intactos; contraste según tokens.
- Sin JS: hero visible, reloj visible, film visible con fallback correcto; sin `opacity: 0` permanente (§44).
- Reduced motion: degradación completa (D8).
- Video ausente: sin crash, sin layout shift, sin JS error, sin icono roto (§57).

## 8. Validación

1. `pnpm format` → `pnpm check` → `pnpm lint` → `pnpm build` → `pnpm test:e2e` → `pnpm validate` (orden del §59).
2. QA manual documentado: entrada, scroll reversible, transición sin corte a negro, video ausente sin roturas, no-JS, reduced-motion.
3. Performance review ligero: solo `transform`/`opacity` animados; sin layout shift por el reloj (dimensiones explícitas).

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Scrub de video sin material real | Fallback NODO siempre funcional; QA §57; material futuro con GOP 6–12 frames (§31). |
| `preload` runtime es hint | No depender del upgrade para corrección visual; fallback siempre impecable. |
| Integración Lenis mal cableada rompe anclas/touch | Receta oficial + `anchors: true` + `syncTouch` default; un solo rAF (ticker de GSAP). |
| `reloj.png` 1.35 MB como LCP | `fetchpriority="high"` + dimensiones explícitas; compresión del asset como tarea separada fuera de fase. |
| Estados ocultos desde CSS rompen no-JS/reduced-motion | D3; test con `javaScriptEnabled: false` y `emulateMedia`. |
| Flakiness de tests sobre sticky+scrub | Asertar estados DOM/geometría con `expect.poll`, no frames (R5). |

## 10. Supuestos

- Repo `ZeilSoft/nodo` = mismo proyecto que el doc llama `ZeilSoftGh/nodo-landing`; se trabaja en la rama existente `feat/home-experience-intro`.
- Stack congelado del bootstrap: sin dependencias nuevas de animación (§2 del doc); CSS de Lenis viene dentro del paquete `lenis` ya instalado.
- El doc de Fase 01 es verdad de producto; cualquier desviación técnica de este diseño queda documentada en el plan y la entrega.

## 11. Criterios de aceptación

- Las validaciones del §59 (check · lint · format · build · validate) y `pnpm test:e2e` en verde.
- Los 7 tests de §58 pasando.
- Criterios visuales de §56 respetados (composición limpia, identidad verde/oro/crema, escena reversible, transición sin corte).
- Entrega del developer con los 9 puntos de §67.
- Envelope del `reviewer` con veredicto `pass` o `pass_with_observations`.
