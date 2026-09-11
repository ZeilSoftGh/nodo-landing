# Plan de implementación — NODO Fase 01 (Intro + reloj + ScrollFilm)

- **Fecha**: 2026-09-09
- **Estado**: listo para `developer`
- **Fuente de verdad de producto**: `docs/NODO — Home Experience - Fase 01.md` (2304 líneas; referencias `§N` en este plan apuntan a sus secciones)
- **Contrato de diseño**: `docs/superpowers/specs/2026-09-09-nodo-fase-01-orchestration-design.md` (decisiones D1–D10, hallazgos R1–R7, riesgos, criterios de aceptación §11). Este plan **no duplica** esas decisiones: las referencia y añade solo lo que la lectura real del código obliga (N1–N5, marcadas como desviaciones/detalle).
- **Formato**: `docs/ai/plans/2026-09-08-bootstrap-core-astro-plan.md`
- **Rama**: `feat/home-experience-intro` (verificada en el repo; NO partir de `main`, §1)
- **Prohibido**: implementar fuera de este plan, Three.js/WebGL (§2/§54), contenido fake (§25/§26), commits de features no pedidas (§67).

---

## Task Contract

- **objective**: Landing real de NODO Fase 01: intro cinematográfica "Bienvenido a la experiencia NODO" con `/reloj.png` como objeto protagonista, transición reversible hacia `ScrollFilm` (video scrub por scroll con fallback sin material), specimen preservado en `/styleguide` con `noindex`, wiring real de GSAP/ScrollTrigger + Lenis y suite Playwright de §58 — todo pasando `pnpm validate` + `pnpm test:e2e` (§59/§11 del design doc).
- **success_criteria**: (1) archivo/estructura final coincide con §6 del design doc; (2) los 7 tests de §58 pasan en `tests/e2e/home-experience.spec.ts`; (3) validaciones §59 + `pnpm test:e2e` en verde en el orden del "Plan de validación"; (4) criterios visuales §56 respetados (QA manual documentado); (5) entrega con los 9 puntos de §67; (6) sin JS la página es completa y legible (§44) y con reduced motion degrada completa (§43/D8).
- **non_goals**: Three.js/WebGL/R3F/3D del reloj/shader (§2/§54); cocktails/cards/menu/reservas/about/footer complejo/NODOFESTA (§54); header tradicional grande (§50); custom cursor (§51); audio/loader de porcentaje/transiciones entre páginas (§54); self-hosting de fuentes (R6); compresión de `reloj.png`; video real ni MP4 fake (§25); commits; tocar `docs/ai/**` (salvo nada — este plan ya está escrito); tocar otras secciones/features fuera de alcance (§67.9); no modificar `smoke.spec.ts`, `playwright.config.ts`, `robots.txt.ts`, `tokens.css` ni la API existente de `createScrollAnimation` (solo extensiones documentadas).
- **assumptions**: el design doc y el doc de producto son verdad; stack congelado (sin dependencias nuevas de animación, §2); las motion libs actuales (`createScrollAnimation`, `createSmoothScroll`, `lenis.css`) están sin usar en ningún sitio (hallazgo estructural del spec, re-verificado) y se **extienden** sin romper su filosofía (lazy + reduced-motion + cleanup explícito); `reloj.png` = 1672×941 no cuadrado (R7); video ausente no debe romper nada (§57).
- **open_questions**: none (bloqueante). Observaciones resueltas como decisiones N1–N5 dentro del plan; ninguna requiere decisión del usuario antes de implementar.
- **accepted_tradeoffs**: (a) `SeoHead` añade sufijo `| NODO` al `<title>` → §48 literal renderiza "NODO — Cóctel Bar | NODO" (N3; no tocar core); (b) video **sin** `src` en markup y **sin** fetch runtime de la ruta convencional — el wiring real llega al añadir el material (N2, clarificación de D4); (c) transición reloj→video por solapamiento de flujo con margen negativo, valores calibrados en implementación (N4); (d) `pnpm format` primero en la validación (§8 del design doc) aunque §59 lo lista después — mismo set de comandos, evita drift entre check y build.
- **validation**: comandos del "Plan de validación" (Windows/PowerShell/pnpm), en ese orden exacto.
- **ask_abort_triggers**: si el build o `astro check` fallan por las extensiones de motion libs y no hay ruta de fix sin dependencias nuevas → escalar; si Lenis+sticky produce saltos no calibrables en mobile con svh → escalar con evidencia (prohibido scroll-jacking o `syncTouch`); si algo contradice los criterios visuales §56 más allá de calibración numérica → parar y escalar (no rediseñar por cuenta propia); si se necesita `is:inline` o inline styles en el HTML nuevo (CSP activo, §51) → parar y escalar; si un test solo puede pasar asertando frames visuales → replantear con estados DOM/geometría (R5) y documentar; nunca entregar con errores silenciados (§59).

---

## 1. Contexto

`src/pages/index.astro` es hoy el specimen visual (1065 líneas con `<style>`); `reloj.png` (1,378,592 bytes) duerme en `public/`; `gsap.ts`/`lenis.ts` tienen fábricas correctas pero **sin ningún consumidor**. Fase 01 conecta todo: la home pasa a ser un compositor de dos escenas sticky con scrub GSAP, Lenis se cablea con la receta oficial, y el specimen se preserva en `/styleguide` con `noindex`. El video real no existe: la sección debe sobrevivir a su ausencia sin un solo error de consola (§57) porque `smoke.spec.ts` ya exige cero errores de consola/`pageerror` en `/`.

Rama verificada: `feat/home-experience-intro` (checkout OK). Working tree: solo el doc de producto sin trackear. `public/reloj.png` presente.

## 2. Decisiones

**Del design doc (obligatorias, no se repiten aquí): D1–D10** (§5 del design doc). Resumen de anclas: D1 sticky+scrub (2 timelines: IntroTimeline + FilmTimeline); D2 wiring real de motion libs (`getScrollTrigger()` lazy + receta oficial Lenis + `lenis/dist/lenis.css` + `anchors: true` + touch nativo); D3 estados ocultos solo vía `gsap.set` tras JS + cleanup con referencias propias (nunca `ScrollTrigger.getAll()`); D4 video sin src + guards + fallback; D5 reloj PNG con dimensiones explícitas; D6 tipografía sin cambios + dorado joyería; D7 specimen→`/styleguide` noindex + index compositor con prerender; D8 reduced motion degrada completo; D9 mobile recorrido menor; D10 tests Playwright de §58.

**Nuevas decisiones por lectura real del código (desviaciones/detalle documentado):**

| # | Decisión | Evidencia en el código |
|---|----------|------------------------|
| **N1** | `global.css` declara `html { scroll-behavior: smooth }` (línea 19) — incompatible con Lenis (afecta `scrollTo` programático que usa `anchors: true`). Además, `lenis/dist/lenis.css` de la versión instalada (1.3.26, 22 líneas) **ya no incluye** la regla clásica `.lenis.lenis-smooth { scroll-behavior: auto !important }` → nadie neutraliza la CSS. Fix: reescribir la regla como `html:not(.lenis) { scroll-behavior: smooth; }` en `global.css` — con Lenis activo (html recibe clase `lenis`) el scroll es gestionado por Lenis; sin JS / reduced motion / en `/styleguide` se conserva el comportamiento actual. Es el único toque permitido a `global.css`; no toca tokens (§3). | `global.css:16–20`; `node_modules/lenis/dist/lenis.css` (22 líneas, sin `scroll-behavior`); `lenis.mjs:1041` (clase `lenis-smooth` en `<html>`) |
| **N2** | `<video>` **sin `src` en el markup Y sin fetch runtime de la ruta convencional**. Si el JS pidiera `/video/nodo-experience.mp4` inexistente, Chromium emite un console error de red que rompería el "cero errores de consola" de `smoke.spec.ts` (D12 del bootstrap) y el QA §57. La ruta convencional `/video/nodo-experience.mp4` (§25) queda documentada en comentario del componente + entrega §67.6; guards `loadedmetadata`/`canplay`/`error` quedan listos para cuando el material llegue y se añada `src` en el markup (cambio de 1 línea). `console.info` solo bajo `import.meta.env.DEV` (§26). | `tests/e2e/smoke.spec.ts:8–15,30–31`; D4 ("sin src inicial"); §26 |
| **N3** | `SeoHead` compone `fullTitle = "${title} | ${siteName}"` (`SeoHead.astro:25`) → con el title provisional de §48 el resultado es "NODO — Cóctel Bar | NODO". Se mantiene el valor de §48 tal cual y el tradeoff se documenta en la entrega; **no** modificar `SeoHead`/core en esta fase. | `SeoHead.astro:25`; `§48`; D7 |
| **N4** | Mecanismo de transición reloj→video (especifica D1+§23): `ScrollFilm` entra por **solapamiento de flujo** — margen superior negativo ≈ `−100svh` (o equivalente) con `z-index` por debajo de la intro, de modo que su viewport sticky se vea *detrás* de la intro durante las fases 35–65% (§22) mientras el velo/fondo del intro se desvanece; FilmTimeline arranca en `top top` exactamente cuando el sticky del intro suelta. Sin `pin: true` (§11). Valores exactos (margen, svh desktop/mobile) = calibración visual con criterio §56 (reversible, sin corte a negro, sin "cambio de sección evidente"). | `§22 35–65%`, `§23`, `§56 Transición`; D1 |
| **N5** | El filtro del sitemap (`!pathname.startsWith('/api')`) incluiría `/styleguide`, contradiciendo la intención `noindex` de §9. Fix: añadir exclusión de `/styleguide` en el filter de `astro.config.ts` (1 línea). Único toque permitido a la config de Astro; documentar en la entrega (§67.3/§67.9). | `astro.config.ts:22–25`; `§9`; D8 (fail-closed, misma filosofía) |

**Otras especificaciones derivadas de la lectura (no son decisiones nuevas):**
- `createScrollAnimation` y `createSmoothScroll` quedan con su API intacta; la home NO los usa para las escenas (las escenas son timelines propias). `createScrollAnimation` no se borra ni se reescribe.
- El grain global ya existe (`global.css:34–43`, `body::before` fijo con `z-index: 100` sobre `main`) → §47: no añadir otra capa de ruido; las escenas no definen texturas propias.
- `playwright.config.ts` usa `node ./dist/server/entry.mjs` como webServer (no `pnpm preview`) por el auto-daemonize de preview — los tests nuevos **heredan la config sin tocarla** (un solo proyecto Chromium, `testDir: 'tests/e2e'`).
- CSP activo en build+preview (`astro.config.ts:33–35`): los `<script>` nuevos deben ser Astro-processed (default, bundled externo) — prohibido `is:inline` en código nuevo (§51; el único `is:inline` existente es el JSON-LD de SeoHead).
- Los targets de GSAP son `data-*` (§16/§24), nunca clases scoped de Astro (evita acoplamiento al hash de scope).

## 3. Reglas duras (el desarrollador no puede romperlas)

1. Sin dependencias nuevas de animación ni ningún paquete nuevo (§2); **Three.js prohibido** en esta fase (§2/§54).
2. No redefinir marca/tokens/typografía (§3/§4): `tokens.css` y `typography.css` intocables. Únicos toques de CSS global permitidos: la regla `scroll-behavior` de N1.
3. Dorado = joyería: poco y con intención (§15). Cream para el texto, oro solo en acentos puntuales.
4. Sin contenido fake: NO crear MP4 falso, NO placeholder visible del video, NO "VIDEO PENDIENTE/ERROR" en pantalla (§25/§26). Fallback = fondo NODO conectado con el hero (§27).
5. Una timeline GSAP con scrub por escena (§61/D1): solo IntroTimeline + FilmTimeline. La entrada al cargar es un tween/timeline de carga sin ScrollTrigger (no viola §61: la regla acota los ScrollTriggers de escena).
6. Cleanup con referencias propias; **prohibido** `ScrollTrigger.getAll()` (§38/D3). Un solo rAF: el ticker de GSAP (§39).
7. Touch nativo: prohibido `syncTouch` y cualquier scroll-jacking (§40/D2/D9). `syncTouch` no se activa.
8. Naming semántico §62: `experience-intro`, `experience-intro__viewport`, `experience-intro__title`, `experience-clock`, `scroll-film`, `scroll-film__viewport`, `scroll-film__video`, `scroll-film__overlay`. Nunca "moon" ni "green-section".
9. Solo Windows/PowerShell + pnpm. Sin `npm`/`yarn`/`bun`. Sin commits (working tree; el commit es decisión posterior del usuario, §3 del design doc).
10. No tocar `docs/ai/**` ni `docs/superpowers/**`; no tocar `smoke.spec.ts`, `robots.txt.ts`, `tokens.css`, `typography.css`, `BaseLayout`, `SeoHead`, `SkipLink`, `SceneCanvas.tsx`, `metadata.ts`.
11. Solo `transform`/`opacity` animados (§60); `svh`/`dvh`, nunca solo `vh` (§42).
12. Sin header grande, sin custom cursor, sin audio (§50/§51/§54).

## 4. Fases y tareas atómicas

> Cada fase termina en un estado coherente y verificable. "Aceptación" = comando o inspección concreta. Orden pensado para que cada fase compile por sí sola; el build completo de la home se valida en F6.

### F1 — Motion libs (wiring real)

*Estado final: `gsap.ts` expone ScrollTrigger lazy; `lenis.ts` integra la receta oficial R2 + CSS + anchors; `scroll-behavior` compatible.*

- **T1.1 `src/lib/motion/gsap.ts` — `getScrollTrigger()` (D2/§36)** — Añadir export que resuelva el singleton ya existente:
  ```ts
  export async function getScrollTrigger() {
    await ensureScrollTriggerRegistered();
    const { ScrollTrigger } = await import('gsap/ScrollTrigger');
    return ScrollTrigger;
  }
  ```
  Reutilizar `scrollTriggerLoader` (no duplicar el dynamic import). Tipar el retorno con el tipo de `gsap/ScrollTrigger`. `prefersReducedMotion()`, `createScrollAnimation()` y `ensureScrollTriggerRegistered()` quedan intactos. Comentar por qué es lazy (§63: "por qué existe una sincronización").
  - *Aceptación*: `pnpm check` compila el archivo; inspección — la función reutiliza el loader existente, no registra plugins en top-level, sin side effects al importar.
- **T1.2 `src/lib/motion/lenis.ts` — receta oficial R2 (D2/§39)** — Extender `createSmoothScroll`:
  - Import top-level de `lenis/dist/lenis.css` (D2) — Vite lo extrae al CSS de la página que importe este módulo.
  - Instanciar con `anchors: true` (default verificado en dist: `anchors = false`, hay que pasarlo). NO pasar `syncTouch` (default `false` = touch nativo). NO pasar `respectReducedMotion` (default `true`). NO `autoRaf` (default `false`).
  - Tras crear la instancia: `const st = await getScrollTrigger()` (import de `./gsap`); registrar `lenis.on('scroll', st.update)`; `const raf = (time: number) => lenis.raf(time * 1000)`; `gsap.ticker.add(raf)`; `gsap.ticker.lagSmoothing(0)`. Importar `gsap` desde `'gsap'`.
  - `destroy()`: `gsap.ticker.remove(raf)` (misma referencia), `lenis.off('scroll', st.update)`, `lenis.destroy()`. Guardar referencias propias.
  - Actualizar el comentario de constraints (§24): anclas vía `anchors: true`, touch nativo, ticker único.
  - *Aceptación*: `pnpm check` + `pnpm lint` en verde para el archivo; inspección — la secuencia `lenis.on('scroll', ScrollTrigger.update)` + `gsap.ticker.add((time) => lenis.raf(time*1000))` + `gsap.ticker.lagSmoothing(0)` presente literalmente; cleanup remueve exactamente lo añadido; no hay `requestAnimationFrame` propio.
- **T1.3 `src/styles/global.css` — `scroll-behavior` (N1)** — Cambiar `html { ... scroll-behavior: smooth; ... }` por `html:not(.lenis) { ... scroll-behavior: smooth; ... }` (solo ese selector; nada más cambia en el archivo).
  - *Aceptación*: inspección de la regla; `tokens.css`/`typography.css` intactos (`git diff --stat` solo toca `global.css` en styles).

### F2 — Styleguide (preservar specimen)

*Estado final: `/styleguide` sirve el specimen completo con noindex; `/` sigue en su estado previo (aún specimen hasta F6).*

- **T2.1 Mover specimen (§9/D7)** — `git mv src/pages/index.astro src/pages/styleguide.astro` (o crear+borrar con contenido idéntico). Conservar `export const prerender = true` y todo el contenido/estilos tal cual (1065 líneas). Actualizar solo: (a) comentario de cabecera del frontmatter (ahora es el specimen interno), (b) añadir `noindex` a las props de `BaseLayout`, (c) title→"NODO — Estándar visual" (sin cambios).
  - *Aceptación*: `src/pages/styleguide.astro` existe con `noindex` + prerender; `src/pages/index.astro` NO existe (se crea en F6; el repo no debe quedar con home rota entre fases → aceptable porque F2 y F6 son contiguas y el estado intermedio no se construye solo).
- **T2.2 Excluir `/styleguide` del sitemap (N5)** — En `astro.config.ts`, filter: `(page) => !new URL(page).pathname.startsWith('/api') && !new URL(page).pathname.startsWith('/styleguide')`.
  - *Aceptación*: inspección del filter; documentado para la entrega.
- **T2.3 Verificación styleguide** — `pnpm build` y comprobar: `dist/client/styleguide/index.html` existe y contiene `noindex, nofollow` (meta robots); `dist/client/sitemap-index.xml` NO lista `/styleguide`; `/` sigue build-eando (temporalmente specimen). Ejecutar `pnpm test:e2e` (smoke debe seguir verde: la home de este estado intermedio aún tiene su h1).
  - *Aceptación*: build exit 0; greps sobre `dist/client/styleguide/index.html` (`Select-String -Pattern "noindex"`) y sobre el sitemap; smoke verde.

### F3 — ExperienceIntro.astro

*Estado final: componente hero completo, legible sin JS, con reloj PNG protagonista.*

- **T3.1 Markup (§13/§16/§45/D5)** — `src/components/home/ExperienceIntro.astro`:
  ```html
  <section class="experience-intro" data-experience-intro>
    <div class="experience-intro__viewport">
      <!-- fondo: capa .experience-intro__veil (gradientes §12) -->
      <h1 class="experience-intro__title">
        <span>Bienvenido a la</span>
        <span>experiencia NODO</span>
      </h1>
      <div class="experience-clock" data-experience-clock aria-hidden="true">
        <img src="/reloj.png" alt="" width="1672" height="941"
             decoding="async" fetchpriority="high" />
      </div>
      <p class="experience-intro__hint">Scroll <span aria-hidden="true">↓</span></p>
    </div>
  </section>
  ```
  H1 único real en la página (Test 2/§13). Reloj: capa independiente, `alt=""` + `aria-hidden` (§16/§49), `width/height` explícitos (R7: 1672×941, NO cuadrado), `fetchpriority="high"` + `decoding="async"`, **sin** `loading="lazy"` (§45/D5). Hint §52 mínimo y discreto.
  - *Aceptación*: inspección — un solo `h1` en toda la página final; img con los 4 atributos de R7/D5; sin texto en canvas/imagen (§13).
- **T3.2 CSS scoped (§11/§12/§14–§18/§41/§42/D6/D9)** — Scoped styles del componente:
  - `.experience-intro { min-height: 220svh; }` desktop; mobile (max-width ~800px): `170svh–190svh` (D9/§41).
  - `.experience-intro__viewport { position: sticky; top: 0; height: 100svh; overflow: hidden; }` (§11).
  - Fondo: capa `__veil` con `radial-gradient(circle at 50% 50%, rgb(13 63 55 / 0.28), transparent 42%)` sobre `var(--nodo-night)` — orientativo §12, no copiar literal; oscuridad dominante.
  - Title: `font-family: var(--font-display)`; desktop `clamp(4rem, 9vw, 10rem)`, mobile `clamp(3rem, 15vw, 6rem)` (§14); `color: var(--nodo-cream)`, "NODO" en `var(--nodo-gold-soft)` (§15: dorado joyería — solo esa palabra o equivalente mínimo); composición editorial con mucho aire (§5/§6/§14), no H1 genérico centrado.
  - Clock: `width: clamp(18rem, 42vw, 42rem)` desktop / `min(80vw, 28rem)` mobile (§17); `aspect-ratio: 1672 / 941`; `height: auto`; completo dentro del viewport inicial sin cortar partes críticas (§17); profundidad solo `drop-shadow(0 2rem 4rem rgb(0 0 0 / 42%)) drop-shadow(0 0 3rem rgb(201 167 67 / 8%))` (§18).
  - Hint: `font-family: var(--font-sans)`, tipografía `.meta`-like discreta.
  - Sin estados `opacity: 0` en CSS (D3/§44): todo visible por defecto.
  - Sin grain propio (grain global ya existe, §47).
  - *Aceptación*: inspección — valores `svh` presentes, clamp de §14/§17 presentes, cero `opacity: 0` en CSS, cero `position: pin`-related, sin animaciones CSS elásticas (bounce/elastic/back prohibidos, §19).

### F4 — ScrollFilm.astro

*Estado final: sección film con video preparado (sin src), overlay y fallback NODO; no rompe nada sin material.*

- **T4.1 Markup (§24/§26/D4)** —
  ```html
  <section class="scroll-film" data-scroll-film>
    <div class="scroll-film__viewport">
      <video data-scroll-film-video muted playsinline preload="metadata"
             aria-hidden="true" disablepictureinpicture></video>
      <div class="scroll-film__overlay" aria-hidden="true"></div>
    </div>
  </section>
  ```
  Sin `src` (D4 + N2). Sin `controls` (§49). Ruta convencional `/video/nodo-experience.mp4` en comentario de frontmatter (§25; la entrega §67.6 la reporta).
  - *Aceptación*: inspección — `muted playsinline preload="metadata" aria-hidden="true"` presentes; cero `src` en el markup.
- **T4.2 CSS scoped (§27/§29/§32/§33/§41/D9)** —
  - `.scroll-film { min-height: 350svh; }` desktop; mobile `220svh–280svh` (§29/§41/D9). `z-index` menor que la intro (para el solapamiento N4) — concretar el valor al calibrar con F5.
  - `.scroll-film__viewport { position: sticky; top: 0; height: 100svh; overflow: hidden; }`.
  - Fallback visual (§27): fondo con `radial-gradient(...), linear-gradient(...), var(--nodo-night)` conectado con el hero (paleta deep/teal/gold sobre night) — se ve mientras no hay video, y desaparece cuando el video cubre.
  - Video (§32): `position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;` sin deformar.
  - Overlay (§33): capa separada, gradiente `top: dark green/transparent → bottom: night/transparent`.
  - Sin autoplay, sin controles, sin icono roto posible (§26/§49).
  - *Aceptación*: inspección — gradientes fallback presentes y derivados de tokens; video con `object-fit: cover`; overlay separado.

### F5 — homeExperience.ts (orquestación)

*Estado final: `src/lib/motion/homeExperience.ts` con init/cleanup completos para ambas escenas, reduced motion y guards de video.*

- **T5.1 Módulo (§37/D1/D3/D8)** — `export function initHomeExperience(): () => void`. Flujo:
  1. **Query por data-attrs**: `[data-experience-intro]`, `[data-experience-clock]` (+ su `img`), `[data-scroll-film]`, `[data-scroll-film-video]`; título/velo/hint vía `querySelector` dentro de la raíz de cada sección. Si falta un nodo crítico → no-op con cleanup seguro (defensivo).
  2. **Reduced motion (D8/§43)**: si `prefersReducedMotion()` (import de `./gsap`) → retornar cleanup no-op: sin `gsap.set` oculto, sin scrub, sin Lenis, sin escrituras de `currentTime`. La página queda en su estado natural (hero + film/fallback estáticos).
  3. **Entrada al cargar (§19)**: `gsap.set(title, {opacity: 0, y: 24})` + `gsap.set(clock, {opacity: 0, scale: .94, y: 30})` (solo tras confirmar JS, D3/§44), luego `gsap.to` de ambos (~0.9–1.1s, `power3.out`; stagger leve entre spans del título). Sin bounce/elastic/back (§19).
  4. **Lenis**: `createSmoothScroll({ lerp ~0.1 })` (import de `./lenis`) — devuelve `null` en reduced motion (fila 2). Un solo rAF vía ticker (R2).
  5. **IntroTimeline (D1/§21/§22)**: `gsap.timeline({ scrollTrigger: { trigger: introSection, start: 'top top', end: 'bottom bottom', scrub: true } })` con las fases de §22 — 0–15% deriva mínima (clock y −0.5vh, texto −1vh); 15–40% texto out (`opacity 1→0`, `y 0→−40`, `letter-spacing` abierto, stagger entre spans); 20–55% reloj (`scale 1→0.72`, `yPercent 0→−8`, `rotation 0→3°` — leve, no spinner); 35–65% revelado de la capa film detrás (`opacity 0→1`, `scale 1.04→1` sobre el viewport del film + desvanecer el velo del intro); 55–85% reloj out (`scale 0.72→0.28`, `opacity 1→0`, `filter blur 0→2px` máx, solo `transform`/`opacity` salvo ese blur mínimo); 85–100% settle — primer frame del film a pantalla completa sin salto (§22/§56/§66). Los tweens que comparten props con la entrada (scale/y del reloj) usan `immediateRender: false` para no pisar la entrada en progreso.
  6. **FilmTimeline (D1/§28/§30/R1)**: tras `loadedmetadata` (guard obligatorio — `duration` es NaN antes, R4): state proxy `{ time: 0 }`, `gsap.to(state, { time: video.duration, ease: 'none', scrollTrigger: { trigger: filmSection, start: 'top top', end: 'bottom bottom', scrub: true, onUpdate: escribir currentTime } })`. Escritura con guard: solo si `readyState >= 1` y `|Δt| > ~0.01s` (anti-writes redundantes, R1); sin loop rAF propio (ScrollTrigger ya sincroniza con el ticker). Sin `preload` upgrade garantizado: al cruzar ~35% de la IntroTimeline (o progreso del film trigger), una sola vez `video.preload = 'auto'` (+ opcional `video.load()` como best-effort si se decide; N4 del design doc: no depende de esto para corregir visual).
  7. **Guards de video (§26/R4)**: listeners `loadedmetadata`/`canplay`/`error` — en `error` (o si nunca llega metadata): estado `videoOk = false` → FilmTimeline no se crea o queda inerte; **nunca** escribir `currentTime`; sin error visual ni icono roto (fallback bg siempre debajo); `console.info` solo bajo `import.meta.env.DEV` (N2/§26).
  8. **Cleanup (§38/D3)**: devolver función que — kill de cada timeline (`tl.scrollTrigger?.kill()` + `tl.kill()`), remove de listeners de video, `gsap.ticker.remove(raf)` + `lenis.off('scroll', st.update)` + `lenis.destroy()` (si esta instancia lo creó). Referencias propias en variables del closure. **Nunca** `ScrollTrigger.getAll()`.
  9. **Resize/refresh (§37)**: cubierto por defaults (`autoResize` de Lenis `true`, auto-refresh de ScrollTrigger) — documentarlo en comentario de cabecera; sin listeners manuales salvo que el QA muestre drift (entonces `ScrollTrigger.refresh()` en un `resize` debounced, justificado en entrega).
  - *Aceptación*: `pnpm check` + `pnpm lint` en verde; inspección — exactamente 2 timelines con scrub, cleanup propio completo, cero `ScrollTrigger.getAll`, cero `syncTouch`, guard de `currentTime` presente, `import.meta.env.DEV` presente, cero listeners `resize` manuales.
- **T5.2 Punto de montaje** — El `<script>` va en `index.astro` (F6). `homeExperience.ts` no debe auto-ejecutarse al importar (filosofía §23: sin side effects top-level).
  - *Aceptación*: inspección — ninguna ejecución en top-level del módulo.

### F6 — index.astro compositor

*Estado final: la home real, prerender, SEO provisional, script inicial.*

- **T6.1 Página (§10/§48/D7)** — Reescribir `src/pages/index.astro`:
  ```astro
  ---
  export const prerender = true;
  import BaseLayout from '@layouts/BaseLayout.astro';
  import ExperienceIntro from '@components/home/ExperienceIntro.astro';
  import ScrollFilm from '@components/home/ScrollFilm.astro';
  ---
  <BaseLayout title="NODO — Cóctel Bar" description="Bienvenido a la experiencia NODO.">
    <ExperienceIntro />
    <ScrollFilm />
  </BaseLayout>
  <script>
    import { initHomeExperience } from '@lib/motion/homeExperience';
    const cleanup = initHomeExperience();
    document.addEventListener('astro:before-swap', cleanup, { once: true });
  </script>
  ```
  Sin header tradicional (§50). El script Astro default = bundled + hoisted + dedupe, corre tras el parse del DOM (querySelector seguro, R3). Sin ClientRouter, `astro:before-swap` no dispara: el listener es el patrón correcto a futuro (§38/R3); el cleanup real corre a nivel de carga de página (R3).
  - *Aceptación*: inspección — compositor puro (sin lógica de animación inline); prerender presente; un solo h1 en el documento (el de ExperienceIntro); SEO §48; script import-only.
- **T6.2 Sanity de build intermedio** — `pnpm build` + `pnpm test:e2e` (smoke completo incl. zero console errors — N2 debe evitar cualquier 404 ruidoso).
  - *Aceptación*: ambos exit 0; `dist/client/index.html` contiene `reloj.png` y `[data-scroll-film]`.

### F7 — Tests Playwright

*Estado final: `tests/e2e/home-experience.spec.ts` con los 7 tests de §58, patrón consistente con `smoke.spec.ts` (chromium, webServer node entry).*

- **T7.1 Archivo de tests (D10/§58/R5)** — Crear `tests/e2e/home-experience.spec.ts`:
  1. **Test 1 (§58.1 + §57)**: `GET /` → 200; recolectar console `error` y `pageerror` → cero (video ausente no genera errores — N2); fallback del film presente (overlay existe).
  2. **Test 2 (§58.2/§13)**: exactamente 1 `h1`; `textContent` normalizado matchea `/Bienvenido a la\s+experiencia NODO/`.
  3. **Test 3 (§58.3/D5/R7)**: `img[src="/reloj.png"]` existe; attrs `width="1672"` `height="941"`; `fetchpriority="high"`; sin `loading="lazy"`.
  4. **Test 4 (§58.4)**: `[data-scroll-film]` existe, contiene `[data-scroll-film-video]` y overlay.
  5. **Test 5 (§58.5)**: sin overflow horizontal — `expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))` ≤ `window.innerWidth` (tolerancia 0).
  6. **Test 6 (§58.6/§44)**: contexto `javaScriptEnabled: false` (via `test.use({ javaScriptEnabled: false })` o `browser.newContext(...)`, R5) → h1 visible, reloj visible (`img` con bounding box no vacío), `[data-scroll-film]` visible; ningún elemento crítico con `opacity: 0` permanente.
  7. **Test 7 (§58.7/D8/§43)**: contexto `reducedMotion: 'reduce'` (via `test.use({ reducedMotion: 'reduce' })` o `page.emulateMedia`) → `<html>` SIN clase `lenis` (Lenis nunca se creó); título y reloj sin estilos inline ocultos (`getAttribute('style')` sin `opacity: 0`); sin scrub inicializado (los elementos no tienen inline transforms de GSAP).
  - Notas de estilo (R5): asertar estados DOM/geometría y computed styles, nunca frames visuales; `expect.poll` para geometría dinámica. Los tests no deben tocar `playwright.config.ts` (heredan webServer node entry + chromium).
- **T7.2 Ejecución local** — `pnpm test:e2e` verde con smoke + home-experience (9 tests aprox. en total).
  - *Aceptación*: exit 0; el reporte lista ambos specs.

### F8 — Validación completa + QA manual + entrega

*Estado final: §59/§8 del design doc en verde; QA visual documentado; entrega §67.*

- **T8.1 Suite completa** — "Plan de validación" completo en orden (sección 7 abajo). Verificación de bundle (con criterio ACTUALIZADO por fase): greps sobre `dist/client/_astro/*.js` — huellas de `three|react-dom|createContext|useState` **ausentes**; `gsap` **presente** (esperado: Fase 01 es el primer wiring real — reemplaza la cláusula gsap/lenis del D9 de bootstrap); `dist/client/index.html` referencia `reloj.png`; `dist/client/styleguide/index.html` con `noindex`.
- **T8.2 QA manual documentado (§56/§57/§59/§60/§67)** — Checklist a reportar en la entrega: entrada al cargar (lenta, pesada, elegante); primer scroll pesado y controlado; reversibilidad completa (scroll ↓/↑ idéntico); transición sin corte a negro y sin "cambio de sección evidente" (§56); film fullscreen y estable sin material; sin crash/errores/infinite loading/CLS por el video (§57); no-JS legible (§44); reduced motion degrada (§43); mobile 390px sin scroll-jacking y con `svh` correcto (§40–§42); teclado (Tab/space ok, skip link intacto, §49); DevTools quick review: CLS 0 del reloj, sin long tasks gruesas, solo `transform`/`opacity` animados (§60).
- **T8.3 Entrega (§67)** — Reporte con los 9 puntos: archivos creados; modificados; decisiones técnicas relevantes (incl. N1–N5); `/reloj.png` encontrado correctamente; video pendiente; ruta exacta futura `public/video/nodo-experience.mp4` (markup `src` cuando llegue); resultado de `pnpm validate`; resultado de Playwright; nada fuera de alcance.

## 5. Mapeo de aceptación → criterios del design doc (§11)

| Criterio §11 design doc | Cubierto por |
|---|---|
| Validaciones §59 (check · lint · format · build · validate) en verde | T8.1 + "Plan de validación" |
| `pnpm test:e2e` en verde | T7.2, T8.1 |
| Los 7 tests de §58 pasando | T7.1 (tests 1–7; Test 8 de §58 queda para cuando exista el video) |
| Criterios visuales §56 | T3.2, T4.2, T5.1 (fases §22) + T8.2 (QA manual) |
| Entrega con los 9 puntos de §67 | T8.3 |
| Envelope `reviewer` con `pass` / `pass_with_observations` | Flujo de orquestación §3 del design doc (post-implementation, fuera del alcance de `developer`) |

Mapeo de decisiones → tareas: D1→T5.1 (5); D2→T1.1, T1.2; D3→T5.1 (1,3,8) + T7.1 (test 6); D4→T4.1, T5.1 (6,7) + N2; D5→T3.1; D6→T3.2; D7→T2.1, T6.1; D8→T5.1 (2) + T7.1 (test 7); D9→T3.2/T4.2 (svh + recorridos) + T8.2; D10→T7.1.

## 6. Plan de validación (orden exacto — Windows / PowerShell / pnpm)

```powershell
# tras F7 completo:
pnpm format          # reformato idempotente (incluye el specimen movido)
pnpm format:check    # exit 0
pnpm check           # exit 0 (TS strict 6.0.3 + astro-check)
pnpm lint            # exit 0, cero warnings
pnpm build           # exit 0; nota prerender de / y /styleguide en la salida
pnpm test:e2e        # verde (build + node entry + chromium)
pnpm validate        # exit 0 (re-verifica check/lint/format:check/build)

# bundle check (T8.1) — criterio actualizado:
Select-String -Path "dist\client\_astro\*.js" -Pattern "three|react-dom|createContext|useState" -ErrorAction SilentlyContinue   # SIN matches
Select-String -Path "dist\client\_astro\*.js" -Pattern "gsap|lenis" -ErrorAction SilentlyContinue                               # CON matches (esperado en Fase 01)
Select-String -Path "dist\client\index.html" -Pattern "reloj.png"
Select-String -Path "dist\client\styleguide\index.html" -Pattern "noindex"

# smoke HTTP (opcional, ya cubierto por test:e2e):
pnpm preview   # terminal 1
# terminal 2:
curl.exe -s -o NUL -w "%{http_code}" http://localhost:4321/            # 200
curl.exe -s -o NUL -w "%{http_code}" http://localhost:4321/styleguide  # 200
curl.exe -s http://localhost:4321/styleguide | Select-String "noindex"

# QA manual documentado (T8.2) sobre preview: entrada / reversible / transición / video ausente / no-JS / reduced-motion / mobile / teclado
```

> Nota de orden: §8 del design doc pone `format` primero (se adopta); el set de comandos es el de §59 y `validate` re-verifica el conjunto completo. Cualquier desviación de orden debe quedar anotada en la entrega.

**Evidencia para la entrega §67 (9 puntos)**: salida de los comandos anteriores + diff `git status/diff --stat` + checklist T8.2.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Scrub de video sin material real | Fallback NODO siempre funcional y debajo; guards R4; QA §57; material futuro con GOP 6–12 frames (§31). N2 evita el 404 ruidoso. |
| `preload` runtime es hint (no garantía) | Upgrade best-effort una sola vez (§35); corrección visual nunca depende del upgrade; fallback siempre impecable. |
| Integración Lenis mal cableada rompe anclas/touch | Receta oficial R2 verificada contra el dist instalado (1.3.26: `anchors` existe, `syncTouch=false` default, `respectReducedMotion=true` default, `autoRaf=false` default); `anchors: true`; un solo rAF (ticker GSAP). |
| `reloj.png` ~1.35 MB como LCP | `fetchpriority="high"` + `width/height` explícitos (sin CLS); compresión del asset = tarea separada FUERA de esta fase. |
| Estados ocultos desde CSS rompen no-JS/reduced-motion | D3: ocultar solo con `gsap.set` tras JS; test 6 con `javaScriptEnabled: false` y test 7 con `reducedMotion`. |
| Flakiness de tests sobre sticky+scrub | Asertar estados DOM/geometría (`expect.poll`, computed style), no frames (R5). |
| **N1-R: `scroll-behavior: smooth` global vs Lenis** (detectado en lectura) | N1: scope a `html:not(.lenis)`; verificación manual de skip link y anclas del specimen en `/styleguide` tras el cambio. |
| **N4-R: solapamiento con margen negativo puede desalinear el punto de arranque de FilmTimeline en mobile/svh** | Calibración en F5 con `svh`; aceptación: reversibilidad + sin salto (§56); si no hay calibración estable, escalar (ask_abort_triggers). |
| **Smoke test zero-console-errors frágil** | N2 (no fetch runtime del video ausente); `console.info` bajo `import.meta.env.DEV`; prohibido `is:inline` nuevo (CSP). |
| Falsos positivos de minificación en greps de bundle | Investigar causa real de cualquier match antes de cerrar T8.1 (mismo criterio que D9 del bootstrap). |
| `astro:before-swap` nunca dispara (sin ClientRouter) | Cleanup a nivel de carga de página (R3); listener registrado `{ once: true }` como patrón a futuro (§38). |

## 8. Non-goals (explícitos)

- No Three.js/WebGL/R3F/shaders/3D del reloj (§2/§54).
- No cocktails/cards/menu/reservas/about/galería/footer complejo/NODOFESTA como página (§54).
- No header tradicional, no custom cursor, no audio, no loader de porcentaje, no transiciones entre páginas (§50/§51/§54).
- No video real ni MP4/placeholder fake; no frame sequence + canvas (§25/§31/§54).
- No self-hosting de fuentes (R6); no compresión de `reloj.png`.
- No commits (solo working tree); no tocar `docs/ai/**`, `docs/superpowers/**` ni el doc de producto.
- No modificar: `smoke.spec.ts`, `playwright.config.ts`, `robots.txt.ts`, `tokens.css`, `typography.css`, `BaseLayout.astro`, `SeoHead.astro`, `SkipLink.astro`, `SceneCanvas.tsx`, `metadata.ts`, `api/*`.
- No tocar la API existente de `createScrollAnimation` (puede quedar sin uso en la home).
- No CSS nuevo en `global.css` más allá de la regla de N1.
- No Test 8 de §58 (scrub sobre `currentTime`) hasta que exista el material real.

## 9. Auto-Forecast

- **estimated_scope**: `large` (>400 líneas no mecánicas: ~700 componentes+CSS, ~250 orquestación, ~120 libs, ~180 tests; +1065 líneas movidas mecánicamente al styleguide).
- **affected_files** (concretos):
  - Nuevos: `src/components/home/ExperienceIntro.astro`, `src/components/home/ScrollFilm.astro`, `src/lib/motion/homeExperience.ts`, `src/pages/styleguide.astro` (movido), `tests/e2e/home-experience.spec.ts`.
  - Modificados: `src/pages/index.astro` (reescrito como compositor), `src/lib/motion/gsap.ts`, `src/lib/motion/lenis.ts`, `src/styles/global.css` (solo N1), `astro.config.ts` (solo N5).
  - Intocables: todo lo listado en Non-goals.
- **suggested_phases**: F1–F8 de este plan (ya definidas y acotadas; F1–F2 infra, F3–F4 secciones, F5 orquestación, F6 compositor, F7 tests, F8 validación/QA/entrega).

---

## 10. Supuestos y evidencia de lectura real

**Archivos leídos completos antes de escribir este plan** (verificación, no suposición):

| Archivo | Líneas | Hechos clave |
|---|---|---|
| `docs/superpowers/specs/2026-09-09-nodo-fase-01-orchestration-design.md` | 113 | D1–D10, R1–R7, riesgos, §11 criterios |
| `docs/NODO — Home Experience - Fase 01.md` | 2304 (§1–§68) | Composición, progresiones §22, valores §11/§17/§29/§41, criterios §56, tests §58, validación §59, entrega §67 |
| `docs/ai/plans/2026-09-08-bootstrap-core-astro-plan.md` | 390 | Formato de referencia (Task Contract → decisiones → fases → mapeo → validación) |
| `src/lib/motion/gsap.ts` | 76 | `prefersReducedMotion()`, `createScrollAnimation()`, loader interno `ensureScrollTriggerRegistered()` — coinciden con el Task Contract |
| `src/lib/motion/lenis.ts` | 63 | `createSmoothScroll({lerp?, wheelMultiplier?})` → `SmoothScrollHandle \| null`; guard reduced-motion local |
| `src/pages/index.astro` | 1065 | Specimen completo con `<style>`; `prerender = true`; h1 "Donde la barra encuentra la noche." |
| `src/layouts/BaseLayout.astro` | 36 | Props: `title, description, canonical?, image?, noindex?`; `#main-content`; `lang="es-AR"` |
| `src/components/core/SeoHead.astro` | 56 | Props confirmadas; `fullTitle = "${title} \| ${siteName}"` (línea 25) |
| `src/components/core/SkipLink.astro` | 26 | `#main-content`, `:focus-visible` |
| `src/styles/tokens.css` | 80 | Tokens de marca completos; `--ease-nodo` (línea 79); **no redefinir** |
| `src/styles/typography.css` | 34 | Roles tipográficos; `:where(h1..)` display |
| `src/styles/global.css` | 78 | `html { scroll-behavior: smooth }` (línea 19) → N1; grain global en `body::before` (§47 ✓); `main { z-index: 1 }` |
| `src/lib/seo/metadata.ts` | 33 | `siteName: 'NODO'`, placeholders |
| `package.json` | 57 | Scripts `validate`/`test:e2e` confirmados; gsap 3.15.0, lenis 1.3.26 |
| `astro.config.ts` | 40 | `output: 'server'`, `csp: true` (build+preview), filter sitemap solo `/api` |
| `playwright.config.ts` | 39 | webServer = `node ./dist/server/entry.mjs` (no `pnpm preview`), Chromium único |
| `tests/e2e/smoke.spec.ts` | 57 | Patrón console/pageerror + request API |
| `node_modules/lenis/dist/lenis.css` | 22 | Sin regla `scroll-behavior` (basante para N1) |
| `node_modules/lenis/dist/lenis.mjs` | — | Defaults verificados: `anchors=false`, `syncTouch=false`, `respectReducedMotion=true`, `autoRaf=false`; clase `lenis-smooth` en html |
| `node_modules/gsap/ScrollTrigger.js` | — | Presente (registro lazy viable) |
| `public/reloj.png` | 1,378,592 bytes | Presente; 1672×941 (R7) |
| `git branch --show-current` | — | `feat/home-experience-intro` ✓ |

**Desviaciones detectadas entre doc de producto/código actual** (todas ya resueltas como N1–N5 arriba): (a) `scroll-behavior: smooth` global incompatible con Lenis y sin neutralización en la CSS del paquete (N1); (b) un fetch runtime del video ausente rompería el contrato de cero errores de consola (N2, clarifica D4); (c) sufijo de título en SeoHead (N3); (d) el sitemap incluiría la página `noindex` (N5). No se detectó ninguna contradicción que bloquee el plan.
