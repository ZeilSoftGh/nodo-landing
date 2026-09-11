# NODO Fase 01 — Upgrade ExperienceIntro: cielo mixto + tilt del reloj (diseño v4 + deltas v5/v6)

- **Fecha**: 2026-09-10 (reconciliación final v4 + delta v5: permiso automático/F1/F2/estrellas; + **delta v6**: continuidad intro→film, aterrizaje del reloj en dock y contrato del asset de drink).
- **Estado**: **listo para desarrollo end-to-end**. Todos los inputs de diseño están en repo y verificados por hash; no quedan bloqueantes.
- **Fuente autoritativa de diseño (en repo, byte-identical)**:
  - `docs/design/experience-intro/DESIGN_SPEC.md` — 38,495 B; sha256 `709b62a1…c68d` (**v6**; añade §13 continuidad/landing/drink; v5 y v4 sin cambios).
  - `docs/design/experience-intro/particles.json` — 9,325 B; sha256 `12c6bbdd…4379` (sin cambios).
  - `docs/design/experience-intro/clock-bbox.json` — 304 B; sha256 `b540f08b…fdaf` (sin cambios).
  - `docs/design/experience-intro/sparks.json` — 6,954 B; sha256 `7fcb2df7…3377` (sin cambios).
- **Handoff aprobado del lead** (2026-09-10, A–G) + spec previa `docs/superpowers/specs/2026-09-10-experience-intro-sky-tilt-design.md` (usados solo para valores ya aprobados que los artefactos no repiten; ver §5).
- **Producto (fuente de verdad)**: `docs/NODO — Home Experience - Fase 01.md` (§11–§23, §40–§47, §52, §54, §56, §58, §60–§62).
- **Plan vigente**: `docs/ai/plans/2026-09-09-nodo-fase-01-plan.md` (F1–F8, implementado en `6f53b0d`).
- **Repo**: `ZeilSoft/nodo` — rama `feat/home-experience-intro` @ `6f53b0d`; artefactos de diseño copiados sin commitear.
- **Alcance**: `large`; sin commits; sin dependencias nuevas; sin Three.js/WebGL.

---

## 0. Problem statement

La intro implementada cumple la composición base (§11–§23), pero:

1. El reloj no reacciona al puntero ni al giroscopio: la referencia conceptual de Mùn (§6) quedó solo en composición y scroll.
2. El fondo (`__veil`) es plano: gradientes sin profundidad atmosférica ni materia (polvo/chispas).
3. La salida del título en el `introTl` (15–40 %) usa fade + uplift + letter-spacing (§22, ejemplo), dirección rechazada en el diseño v4 porque el desplazamiento vertical puede ocluir el reloj y compite con la lectura.
4. No existe un contrato medido que garantice que la tipografía y el reloj no se pisen en ningún estado (inicial, tilt, scrub, salida).

El upgrade v4 agrega un cielo decorativo mixto (polvo + chispas, DOM/SVG), tilt sutil del reloj y de las capas, UX de permiso de sensores y un contrato de no-oclusión verificado por test. Este documento es el contrato de implementación reconciliado con los artefactos de diseño.

## 1. Contexto

- Astro 7.3.1 (output `server`, `prerender = true` en `/`), GSAP 3.15.0, Lenis 1.3.26, Tailwind 4, Playwright 1.63.0 (proyecto Chromium único, `webServer = node ./dist/server/entry.mjs`).
- CSP activa en build/preview (`astro.config.ts` → `security.csp: true`): **prohibido `is:inline` y atributos `style=""`**; los `<script>`/`<style>` procesados por Astro son la única vía. Los datos del polvo/chispas deben llegar como atributos de presentación SVG y clases (DESIGN_SPEC §4).
- `homeExperience.ts` ya define exactamente 2 timelines con scrub (IntroTimeline + FilmTimeline) y una entrada sin ScrollTrigger (§61). El upgrade no agrega timelines con scrub: solo tweens dentro del `introTl` y setters `gsap.quickTo` compartidos por puntero y gyro (DESIGN_SPEC §1.2/§6).
- El `introTl` actual ya escribe `transform`/`opacity` sobre `title`, `titleLines`, `clock`, `veil`, `filmViewport` y `hint` (más un `filter: blur(2px)` heredado). Los módulos nuevos serán dueños exclusivos de `x`/`y`/`rotation` de sus targets para no colisionar propiedades.
- El target del tilt es la **`<img>` del reloj** (no el contenedor): entrada y scrub escriben sobre `.experience-clock` (div), el tilt sobre la imagen; así no compiten por `y`. Las capas reciben `x`/`y`/`rotation`; el scrub del cielo usa `yPercent`/`scale`/`opacity` (propiedades disjuntas).
- No hay runner unitario (solo Playwright): toda validación nueva es e2e + inspección estática/greps. **No agregar Vitest ni otra dependencia.**
- `.experience-intro__viewport` ya tiene `overflow: hidden` y `position: sticky`: las capas del cielo se posicionan con `inset: 0` y se recortan solas.
- `main { z-index: 1 }` (`global.css`) y `.experience-intro { z-index: 2 }`: el cielo queda dentro del viewport, no cambia el apilado global.
- El asset de máscara ya existe: `public/nodo_logo_vector_flat.svg` (2048×2048, un `<path>`, sin `fill` explícito → opaco para `mask`). No se preloadea.

## 2. Objetivo

Implementar el upgrade aprobado sobre `ExperienceIntro`/`homeExperience`/`ScrollFilm`:

- Cielo decorativo SSR (polvo SVG + chispas con máscara) visible sin JS y estático bajo reduced motion.
- Tilt híbrido: parallax de puntero en desktop (fine pointer > 800 px) y giroscopio en mobile (coarse pointer ≤ 800 px) con pipeline de permiso automático (v5).
- Deriva de scroll del cielo dentro del `introTl` existente.
- Salida lateral del título (reemplaza el ejemplo de §22) completando en 40 %.
- **v6 — continuidad intro→film**: film fallback = stack del velo, opacidad constante 1, sin scale de panel, overlay gateado a video real.
- **v6 — aterrizaje del reloj**: el dissolve 55–85 % se reemplaza por el tween al dock; el reloj queda visible y nítido al 100 %.
- **v6 — contrato del drink** documentado (spec-only hasta que exista el asset).
- Geometría sin oclusión garantizada por test automatizado.
- Doc de producto actualizado de forma mínima (§22/§53 supersesión, §56 referencia).

## 3. Non-goals

- No nuevas dependencias, plugins ni fuentes. El SVG del logo existente es la única máscara. El asset de drink es **futuro** (fuera de este delta; contrato en §7.10, sin código hasta que exista).
- No Three.js/WebGL/canvas/shaders/3D del reloj (§2/§54).
- No nuevas timelines con ScrollTrigger: siguen existiendo **exactamente 2** (§61).
- No animar propiedades fuera de `transform`/`opacity` (§60). El `filter: blur(2px)` del dissolve 55–85 % **se elimina con el landing v6**; no se introducen filtros nuevos (los drop-shadows del reloj/drink son estáticos). La máscara y el halo son estáticos.
- No segunda capa de grain/noise (§47).
- No cambiar tipografías, tokens, `global.css`, `index.astro`, `SeoHead`, `BaseLayout` ni el doc de producto más allá de las tareas T4.1. `ScrollFilm.astro` **sí** cambia en v6 (backdrop/overlay/scale, §7.9) y nada más.
- No persistir la decisión de permiso (nada de `localStorage`/cookie/sessionStorage); memoria de página únicamente (DESIGN_SPEC §1.1).
- No prometer funcionalidad de sensores en desktop ni en iOS sin HTTPS.
- No tocar `tests/e2e/home-experience.spec.ts` ni `tests/e2e/smoke.spec.ts` (deben quedar verdes sin cambios).
- **No inventar valores de diseño**: si un valor no está en los artefactos ni en §5, se escala; no se rellena por criterio propio.

## 4. Inputs usados

| Fuente | Estado | Uso |
|---|---|---|
| `docs/design/experience-intro/DESIGN_SPEC.md` (v6; sha256 `709b62a1…c68d`) | Leído completo (305 líneas) | §13 v6: continuidad intro→film, dock de aterrizaje del reloj, contrato del asset de drink, criterios C1–C7 y supersesión §22/§53; más v5 (permiso automático, F1/F2, estrellas) y v4 (exit) |
| `docs/design/experience-intro/particles.json` (sha256 `12c6bbdd…4379`) | Leído completo | 150 coordenadas literales `[x,y]` (0–100), `seed 0x4E4F444F`, `stats { total:150, warm:114, cool:36 }` |
| `docs/design/experience-intro/clock-bbox.json` (sha256 `b540f08b…fdaf`) | Leído completo | Constantes exactas del bbox visible del reloj (`fx.x0/x1/y0/y1`) |
| `docs/design/experience-intro/sparks.json` (sha256 `7fcb2df7…3377`) | Leído completo (267 líneas) | Tabla autoritativa de las 11 chispas: `leftPct`, `topPct`, `sizePxDesktop`, `sizePxMobile`, `opacity`, `rotationDeg`, `tone`, `twinkle`, `twinkleDelaySec`, `visibleMobile`, `mobileOverride` (#7), más `hiddenOnMobile [3,9,11]`, mask, halo y parámetros de twinkle |
| Handoff aprobado del lead (2026-09-10, A–G) + spec previa | Leídos | Decisiones de producto ya aprobadas que los artefactos no repiten: split de buckets de `r` del polvo (68/24/8), seed de re-derivación, y el marco general del upgrade |
| `docs/NODO — Home Experience - Fase 01.md` | Leído completo | Reglas de producto, §22 a superseder, §56/§60/§61/§62 |
| `docs/ai/plans/2026-09-09-nodo-fase-01-plan.md` + diseño de orquestación 2026-09-09 | Leídos | Estado implementado, convenciones, D1–D10/R1–R7 |
| `src/**` relevante + `tests/e2e/*` + configs | Leídos | Puntos de inserción, invariantes, CSP, lint |

## 5. Supuestos (solo lo que los artefactos no fijan; nada de esto cambia valores de diseño)

1. **Encoding del polvo**: `cx`/`cy` porcentuales + `r` en px dentro de un `<svg width="100%" height="100%">` **sin `viewBox`** → puntos redondos y `r` de 0.7–2.0 px reales en todo viewport (coincide con “r 0.7–2.0 px” de DESIGN_SPEC §5). Si el mock v2 usaba otro encoding, manda el mock.
2. **Reconstrucción de `r`/`opacity`/`tone` del polvo**: `particles.json` solo trae `[x,y]`; la asignación por punto se re-construye con una regla determinista (D2/§7.2.2) acotada por los rangos de DESIGN_SPEC §5 y los conteos de `stats`. Si `check-mock.mjs` o el mock v2 aparece con los valores por punto, mandan esos.
3. **Rotación del gyro (v5)**: “sparks 48 % (rotation `n·0.45°`), dust 36 % (rotation `n·0.34°`)” se interpreta con `n` del eje x (tilt izquierda/derecha), consistente con el modelo de puntero (rotación horizontal). Ajuste de una línea si la QA muestra otra cosa. No confundir con `rotationDeg` de `sparks.json`, que es una rotación estática por chispa.
4. **Fila `unsupported` de DESIGN_SPEC §1.1 (v5)**: se interpreta como “no existe `DeviceOrientationEvent` o API inutilizable”; la fila `auto` (evento sí, `requestPermission` no es función) gobierna el auto-start Android, coherente con la recomendación explícita del propio spec.
5. **Split “78/22” vs stats “114/36”**: DESIGN_SPEC §5 dice 78 % cream / 22 % stone; `particles.json.stats` dice 114 warm / 36 cool (= 76/24). Se adopta el JSON (dato realizado con la semilla); ver §8.
6. **Open questions no bloqueantes de DESIGN_SPEC §10** adoptadas con sus defaults: (a) salida en portrait con una sola ventana de 25 unidades (sin `matchMedia`); (b) sin fade residual en el exit; (c) tablets > 800 px = layout desktop sin puntero ni gyro.
7. Playwright es el único mecanismo de validación automatizada; el permiso se simula por estado con `context.addInitScript` (granted/denied/`'prompt'`/reject/ausente) y el evento `deviceorientation` con el constructor `DeviceOrientationEvent` (DESIGN_SPEC §8).
8. El contrato de no-oclusión se mide con las fracciones exactas de `clock-bbox.json`; en v5 **el presupuesto del reloj no cambia** (±min(24, 6.2vw) / ±14 px) y las estrellas (sparks/dust) son capas decorativas fuera del contrato de oclusión (su aumento no lo afecta; DESIGN_SPEC §1.3/§3).
9. **“Pedir de nuevo en la próxima oportunidad” = próxima carga de página**: DESIGN_SPEC §1.1 define que tras una denegación resuelta no hay reintento en la misma carga; una carga nueva ejecuta otra vez el intento de carga. Es la interpretación autoritativa del requisito del usuario (iOS no re-muestra el prompt solo).
10. **F1/F2 son contrato, no supuestos**: resultados no finales de `requestPermission()` nunca equivalen a denegación (F1); el release por scrub se invoca en el cruce de umbral desde `onUpdate`, sin esperar input (F2).
11. **Continuidad v6**: el fondo del film debe copiar **exactamente** el stack del velo vigente en `ExperienceIntro.astro` (los tres valores de DESIGN_SPEC §13.1); si el velo cambia, el film lo sigue. El umbral aceptado es delta ≤ 2 por canal en el píxel muestreado.
12. **Landing v6**: la posición del dock y las métricas del reloj se miden en runtime (`getBoundingClientRect` del dock + `clock.offsetWidth`); `LANDED_SCALE` = 0.32 desktop / 0.30 mobile (acceptable `matchMedia` o function values); `invalidateOnRefresh` ya presente recalcula en resize.
13. **Dock decorativo**: el nodo existe vacío en producción (el mock solo dibuja un placeholder dashed para review); `aria-hidden`, `pointer-events: none`, sin foco, sin overflow. El drink futuro lo llenará.
14. **Drink (spec-only)**: no se escribe ningún `<picture>`/`<img>` hasta que el asset exista; el contrato de formato, tamaños, presupuestos, carga y QA (§7.10) queda fijado ahora y el swap es una tarea futura.

> Chispas: **sin supuestos**. Todos sus valores vienen literalmente de `sparks.json` (incluida la ausencia de `animation-delay` en el índice 5: `twinkleDelaySec: null` → no se emite la propiedad y aplica el default CSS de 0 s; es intencional, no un dato faltante).

## 6. Decisiones de implementación

| # | Decisión | Razón / evidencia |
|---|---|---|
| D1 | Cielo 100 % DOM/SVG: `.experience-sky` con polvo (SVG inline) y chispas (`<span>` con `mask` del logo flat). Sin canvas, sin assets nuevos. | DESIGN_SPEC §4/§5; §2/§54 |
| D2 | Polvo: copiar `docs/design/experience-intro/particles.json` → `src/lib/experience/sky-dust.json` (byte-identical) y enriquecer en build-time desde `src/lib/experience/sky.ts` con regla determinista (coordenadas literales; `r`/`o`/`tone` reconstruidos por rango/conteos). | DESIGN_SPEC §5; tarea 2 del handoff de reconciliación |
| D3 | Encoding `cx`/`cy` % + `r` px, sin `viewBox` (supuesto 1). | Mantiene círculos redondos y `r` físico |
| D4 | Cero timelines nuevas: deriva del cielo y salida del título dentro del `introTl` existente; inputs con `gsap.quickTo` compartidos. | DESIGN_SPEC §6; §61 |
| D5 | Módulos `pointerParallax.ts` y `deviceTilt.ts`, creados una vez, con cleanup propio. Tilt sobre la `<img>` del reloj; capas reciben `x`/`y`/`rotation`. | DESIGN_SPEC §1.2/§6; evita colisión de propiedades |
| D6 | **Sin control interactivo (v5)**: pipeline de permiso automático al cargar + reintento one-shot en el primer gesto; único UI = label no interactivo `experience-tilt`/`__title`/`__hint`, después del hint, SSR `hidden`, `role="status"`, `pointer-events: none`. | DESIGN_SPEC §1.1/§1.1.1/§4 |
| D7 | Android (`requestPermission` no es función): auto-start tras completar la entrada, sin UI. iOS: intento de carga; si queda pendiente/no-final, retry por gesto; movimiento solo con grant + entrada completa. | DESIGN_SPEC §1.1/§1.4 |
| D8 | Gyro: `gamma→x`, `beta→y` con baseline de 8 muestras (≤320 ms); `n = clamp((|d| ≤ 1.5 ? 0 : d)/25, −1, 1)`; EMA α=0.2; amplitudes v5 por profundidad (tabla §7.3.2). | DESIGN_SPEC §1.2/§1.3 |
| D9 | Compensación de orientación con la fórmula exacta de DESIGN_SPEC §1.2 (`cos/sin` sobre `screen.orientation.angle`); landscape fuera del contrato de no-oclusión. | DESIGN_SPEC §1.2/§3 |
| D10 | Pausa (fuera de viewport / `document.hidden` / cambio de orientación): liberar offsets a 0, ignorar muestras y re-baseline al volver. | DESIGN_SPEC §1.4 |
| D11 | Release por scrub (F2, puntero + gyro): invocado desde el `onUpdate` del `introTl` **en el cruce** de `> 0.003` → todos los setters a 0; re-armado al cruzar hacia abajo. Ya no espera el próximo evento de input. | DESIGN_SPEC §1.4/§6 |
| D12 | Sin `style=""`, sin `set:html`, sin `is:inline`; colores por clase, opacidad por atributo, tamaños por custom properties. | CSP + DESIGN_SPEC §4 |
| D13 | No-oclusión verificada en Playwright con rects × constantes exactas de `clock-bbox.json` (sin snapshots visuales). | DESIGN_SPEC §3/§8; R5 |
| D14 | Nombres semánticos del design (`experience-sky`, `experience-tilt`, …); “moon” prohibido. | §62; DESIGN_SPEC §4 |
| D15 | El label de denegación se retira con el hint: se incluye en el tween `opacity → 0` de 0–8 % del `introTl`. | DESIGN_SPEC §1.1.1 |
| D16 | Memoria de decisión module-scoped (página actual), sin storage; tras una denegación resuelta no hay reintento en la misma carga (la próxima carga vuelve a intentar). | DESIGN_SPEC §1.1 |
| D17 | Doc de producto: edición mínima (§12, §17, §22, §53, §56) + nota de supersesión del ejemplo de salida y de “el reloj desaparece” (§22/§53), referencia a §56 para la continuidad v6; el spec de diseño en repo es la referencia del upgrade. | Handoff G + DESIGN_SPEC §13.5 |
| D18 | Chispas: `docs/design/experience-intro/sparks.json` es la fuente única. Se copia byte-identical a `src/lib/experience/sky-sparks.json`; `sky.ts` la tipa y el template la consume para flags (twinkle, `visibleMobile`, tone) y orden; la geometría se materializa en clases `--N` (CSP prohíbe `style=""`), y una **prueba de paridad** lee el JSON y compara cada valor contra el DOM. | Tarea de reconciliación final; CSP + DESIGN_SPEC §4 |
| D19 | **F1**: `requestPermission()` puede resolver `'prompt'`/`'default'`/`undefined`/string desconocido o rechazar; nada de eso es denegación. Se mapea a `pending`/`prompt-unknown` con reintento armado, sin label y sin copy de error. Solo `'denied'` resuelto muestra el label. | DESIGN_SPEC §1.1/§9 (G3) |
| D20 | **F2**: el release por umbral es una transición de estado del scrub, no un efecto de input: `onUpdate` compara `self.progress > 0.003` contra el estado previo y, en el cruce, llama `setReleased(true)` en ambos módulos (setters a 0 y bloqueo de input); al cruzar hacia abajo, `setReleased(false)`. | DESIGN_SPEC §1.4/§9 |
| D21 | **Amplitudes de estrellas v5**: puntero sparks `/32` + rot `/2000`, dust `/40` + rot `/2600`; gyro sparks 48 % + rot `n·0.45°`, dust 36 % + rot `n·0.34°`. Reloj intacto (`/15` y ±min(24, 6.2vw)/±14). | DESIGN_SPEC §1.3/§6 |
| D22 | **Continuidad v6**: el fallback del film usa el stack exacto del velo; el viewport del film queda a `opacity: 1` constante (se elimina el tween 0→1) y sin transform de panel (se elimina `scale 1.04→1`); el overlay nace `opacity: 0` y solo pasa a 1 (0.4 s ease) cuando el video real tiene metadatos. Así el compuesto en 35–65 % es idéntico al velo. | DESIGN_SPEC §13.1/§13.4 (C1/C2) |
| D23 | **Aterrizaje v6**: el dissolve del reloj (55–85 %) se reemplaza por un tween function-based único dentro del `introTl` que lleva el **wrapper** del reloj al centro del dock (`x/y` medidos, `yPercent 0`, `scale 0.32/0.30`, `rotation 0`, `ease none`, 55→85 %, `invalidateOnRefresh`), sin `opacity`/`filter`; el reloj queda visible y nítido al 100 %. Sin Flip ni deps nuevas. | DESIGN_SPEC §13.2/§13.4 (C3/C4) |
| D24 | **Drink (placeholder)**: el asset no existe; se fija solo el contrato (§7.10). El nodo dock queda vacío y decorativo; el `<picture>` AVIF/WebP/PNG se agrega en una tarea futura con `loading="lazy"`, `decoding="async"`, dimensiones explícitas, `fetchpriority="low"`, `aria-hidden`, `alt=""`. | DESIGN_SPEC §13.3/§13.4 (C7) |

## 7. Contratos

### 7.1 Contrato de DOM / markup

`src/components/home/ExperienceIntro.astro` (orden exacto dentro de `.experience-intro__viewport`):

```astro
<section class="experience-intro" data-experience-intro>
  <div class="experience-intro__viewport">
    <div class="experience-intro__veil" aria-hidden="true"></div>

    <div class="experience-sky" data-experience-sky aria-hidden="true">
      <div class="experience-sky__dust" data-experience-sky-dust>
        <svg class="experience-sky__dust-field" width="100%" height="100%" focusable="false">
          {SKY_DUST.map((dot) => (
            <circle
              class={`experience-sky__dust-dot experience-sky__dust-dot--${dot.tone}`}
              cx={`${dot.x}%`}
              cy={`${dot.y}%`}
              r={dot.r}
              opacity={dot.o}
            />
          ))}
        </svg>
      </div>

      <div class="experience-sky__sparks" data-experience-sky-sparks>
        {SKY_SPARKS.map((spark) => (
          <span
            class={`experience-sky__spark experience-sky__spark--${spark.index}${
              spark.twinkle ? ' experience-sky__spark--twinkle' : ''
            }${spark.visibleMobile ? '' : ' experience-sky__spark--mobile-hidden'}`}
            data-spark-index={spark.index}
          />
        ))}
      </div>
    </div>

    <h1 class="experience-intro__title">… (sin cambios) …</h1>

    <div class="experience-clock" data-experience-clock aria-hidden="true">… (sin cambios) …</div>

    <div class="experience-dock" data-experience-dock aria-hidden="true"></div>

    <p class="experience-intro__hint">… (sin cambios) …</p>

    <p class="experience-tilt" data-experience-tilt role="status" hidden>
      <span class="experience-tilt__title">Viví la experiencia completa</span>
      <span class="experience-tilt__hint">
        Habilitá el acceso a movimiento y orientación en Ajustes › Safari y volvé a entrar.
      </span>
    </p>
  </div>
</section>
```

Reglas duras:

- `[data-experience-sky]` va **entre** `__veil` y el `h1`; `aria-hidden="true"`; `pointer-events: none`; sin `style=""`.
- 150 `<circle>` SSR desktop (siempre 150 en DOM; 75 visibles ≤ 800 px); render con `.map()` (fragmento), **nunca `set:html`**; el polvo usa atributos de presentación SVG (DESIGN_SPEC §4).
- 11 `<span>` SSR desktop; 8 visibles ≤ 800 px (se ocultan los índices `[3, 9, 11]` según `hiddenOnMobile`/`visibleMobile` de `sparks.json`). `data-spark-index` existe para la prueba de paridad.
- El label va **después** del hint y nace `hidden`; solo JS lo muestra en `denied` + entrada completa. Paint order: veil < sky < title < clock < dock < hint < label.
- El dock (v6) va **después del reloj**, vacío y decorativo: `aria-hidden="true"`, `pointer-events: none`, sin contenido focusable, sin estilo visual en producción (el placeholder dashed es solo del mock). Es el ancla del aterrizaje (§7.3.5) y el marco del futuro drink (§7.10).
- **No hay ningún control interactivo**: cero `<button>`, cero `[data-experience-tilt-ask]`, cero elementos con `tabindex >= 0` dentro del intro. El label es un `<p>` con `role="status"` y `pointer-events: none`. La sección **no** lleva `tabindex="-1"` (ya no hay foco programático: el ask fue retirado en v5).
- No se agregan hooks de test a producción; los tests usan los `data-*` canónicos (`[data-experience-tilt]`, `[data-experience-sky*]`, `[data-spark-index]`) y el label se localiza por `role="status"`/texto.
- `index.astro` no cambia (mismo script de montaje).

### 7.2 Contrato de estilos / tokens

Todo el CSS nuevo vive en el `<style>` scoped de `ExperienceIntro.astro`. No se toca `tokens.css`, `typography.css` ni `global.css`.

**Cielo (`[data-experience-sky]`)**

```css
.experience-sky {
  position: absolute;
  inset: 0;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(0deg, transparent 0%, rgb(0 0 0 / 0.5) 26%, #000 58%);
  mask-image: linear-gradient(0deg, transparent 0%, rgb(0 0 0 / 0.5) 26%, #000 58%);
}
.experience-sky__dust,
.experience-sky__sparks { position: absolute; inset: 0; }
.experience-sky__dust-field { width: 100%; height: 100%; }
```

**Polvo**

```css
.experience-sky__dust-dot { fill: var(--nodo-cream); }
.experience-sky__dust-dot--stone { fill: var(--nodo-stone); } /* #a9aa98 */
@media (max-width: 800px) {
  .experience-sky__dust-field circle:nth-of-type(2n) { display: none; } /* 150 → 75 */
}
```

- 150 puntos en el orden literal de `particles.json`; `cx`/`cy` = valores del archivo como `%`; `r` 0.7–2.0 px; `opacity` 0.10–0.30; `tone` cream/stone según stats (114/36); sin animación de polvo.
- **Materialización (obligatoria, ver §7.2.2)**: `src/lib/experience/sky-dust.json` es copia byte-identical de `docs/design/experience-intro/particles.json`; `src/lib/experience/sky.ts` la enriquece en build-time (nunca en runtime cliente) y exporta `SKY_DUST`.

**Chispas**

```css
.experience-sky__spark {
  position: absolute;
  width: var(--s);
  height: var(--s);
  opacity: var(--o);
  background: var(--nodo-gold);
  -webkit-mask: url('/nodo_logo_vector_flat.svg') center / contain no-repeat;
  mask: url('/nodo_logo_vector_flat.svg') center / contain no-repeat;
  transform: rotate(var(--r));
}
/* Una regla por índice `.experience-sky__spark--N` con los valores EXACTOS de sparks.json:
   left: leftPct%; top: topPct%; --s: sizePxDesktop px; --o: opacity; --r: rotationDeg deg.
   background: var(--nodo-gold-soft) cuando tone === 'gold-soft' (índices 1 y 7). */
.experience-sky__spark::before {           /* halo estático, sin filter (haloDetail de sparks.json) */
  content: '';
  position: absolute;
  inset: -150%;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgb(228 199 122 / 0.26), transparent 72%);
}
@media (max-width: 800px) {
  .experience-sky__spark--mobile-hidden { display: none; }   /* índices 3, 9, 11 */
  /* Por índice visible: --s pasa a sizePxMobile del JSON (valor ya calculado, no calc()).
     Override de posición: .experience-sky__spark--7 { left: 88%; top: 33%; } */
}
@media (prefers-reduced-motion: no-preference) {
  .experience-sky__spark--twinkle {
    animation: experience-sky-twinkle 8s cubic-bezier(0.45, 0, 0.55, 1) infinite alternate;
  }
  .experience-sky__spark--1 { animation-delay: -2.4s; }
  .experience-sky__spark--7 { animation-delay: -5.1s; }
  /* Índice 5: twinkleDelaySec === null en la fuente → NO se declara animation-delay;
     aplica el default CSS de 0 s. Intencional, no es un dato faltante. */
}
@keyframes experience-sky-twinkle {
  to { opacity: calc(var(--o) * 0.82); }
}
```

- Los valores por índice **no se escriben a mano en la lógica**: provienen de `sparks.json` (D18/§7.2.3). El spec no duplica la tabla de 11 filas; la referencia canónica es el archivo.
- Color `--nodo-gold`, con `tone: "gold-soft"` en los índices 1 y 7. El twinkle solo aplica a los índices con `twinkle: true` (`1`, `5`, `7`), con la animación exacta del JSON.
- El twinkle anima **opacity de la chispa**; el tilt anima `transform` del contenedor `.experience-sky__sparks` (propiedades distintas; la rotación estática `--r` vive en el span).

**Fuente de datos de chispas (T1.3)**

`docs/design/experience-intro/sparks.json` es la **fuente única de verdad**. Campos disponibles: `countDesktop` (11), `countMobile` (8), `sizeRangeDesktopPx`, `sizeScaleMobile` (0.85), `opacityRange`, `mask` (`/nodo_logo_vector_flat.svg`) + `maskNote`, `haloDetail`, `twinkle { indices, animation, gating, amplitude }`, `hiddenOnMobile` (`[3, 9, 11]`), `sizePxMobileDerivation`, y `sparks[]` con `index`, `leftPct`, `topPct`, `sizePxDesktop`, `sizePxMobile`, `opacity`, `rotationDeg`, `tone`, `twinkle`, `twinkleDelaySec`, `visibleMobile`, `mobileOverride` (override de `#7`: `left 88 / top 33`). Los `sha256` de las fuentes del mock quedan registrados en el propio JSON (`source`). Materialización en §7.2.3.

**Control de permiso (`.experience-tilt`, DESIGN_SPEC §1.1)**

```css
.experience-tilt {                 /* NUNCA display incondicional */
  position: absolute;
  right: 0;
  bottom: calc(clamp(1.5rem, 4svh, 3rem) + 1.75rem);
  left: 0;
  pointer-events: none;            /* no puede bloquear gesto ni scroll */
  text-align: center;
}
.experience-tilt:not([hidden]) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}
.experience-tilt__title {
  color: var(--nodo-cream);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.experience-tilt__hint { color: rgb(169 170 152 / 80%); font-size: 0.58rem; } /* stone 80 % */
```

- **Gotcha documentado**: nunca declarar `display` en la regla base `.experience-tilt`; un `display` de autor gana al `[hidden]` del UA y el label se vería sin JS. Usar `:not([hidden])` (o además `.experience-tilt[hidden] { display: none; }`).
- El label **no es interactivo**: sin `cursor`, sin `:hover`, sin foco (ya no se elimina outline porque no hay elemento enfocable asociado; `.experience-intro:focus { outline: none; }` se retira junto con `tabindex="-1"`).
- El label se retira con el hint en el tween 0–8 % (D15).

**Geometría (ver §7.5)** — se reemplazan los valores actuales:

```css
.experience-intro__title { row-gap: clamp(12rem, 52svh, 34rem); }        /* desktop */
.experience-clock { width: clamp(18rem, 40vw, 42rem);
                    max-width: calc(40svh * (1672 / 941)); }             /* desktop */

@media (max-width: 800px) {
  .experience-intro__title { row-gap: clamp(7.5rem, 34svh, 16rem); }     /* v3: 34svh */
  .experience-clock { width: min(80vw, 24rem);
                      max-width: calc(32svh * (1672 / 941)); }
}
```

- Font clamps sin cambios (`clamp(4rem, 9vw, 10rem)` / `clamp(3rem, 15vw, 6rem)`).
- El resto del CSS del componente (veil, hint, img, drop-shadows) no cambia.

**Dock de aterrizaje (`.experience-dock`, v6)** — nuevo nodo después del reloj:

```css
.experience-dock {
  --dock-w: 106px;
  --dock-h: 300px;
  position: absolute;
  top: 74%;
  left: 50%;
  width: var(--dock-w);
  height: var(--dock-h);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
@media (max-width: 800px) {
  .experience-dock { --dock-w: 54px; --dock-h: 150px; }
}
```

- En producción el dock es **invisible** (sin background/border): el rectángulo dashed del mock es solo review. El futuro drink (§7.10) lo llena.
- Es el target de medición del aterrizaje (§7.3.5): el centro visible del reloj aterriza en su centro.
- El `transform: translate(-50%, -50%)` es del dock, no del reloj; no interfiere con el scrub (el wrapper del reloj es el animado).

### 7.2.2 Materialización del polvo (plan explícito para `developer`)

1. **Copiar byte-identical**: `docs/design/experience-intro/particles.json` → `src/lib/experience/sky-dust.json`. No editar valores ni formato. Estructura: `{ seed: "0x4E4F444F", stats: { total: 150, warm: 114, cool: 36 }, points: [ [x, y], … 150 ] }`.
2. **Enriquecer en build-time** desde `src/lib/experience/sky.ts` (nuevo). El módulo se importa solo desde el frontmatter de `ExperienceIntro.astro` (página prerender), por lo que nunca llega al bundle cliente. Exporta:
   - `interface SkyDustPoint { x: number; y: number; r: number; o: number; tone: 'cream' | 'stone' }`
   - `const SKY_DUST: readonly SkyDustPoint[]` con 150 entradas en el orden del archivo.
3. **Regla determinista de reconstrucción** (única permitida; no hay valores por punto en el artefacto):
   - `tone`: cuota exacta warm=114 / stone=36 sobre el orden del archivo, con la cuota Bresenham `warm(i) = floor((i+1)*114/150) > floor(i*114/150)` (coincide con `stats`).
   - `r`: cuota exacta 102/36/12 (68/24/8, handoff previo) con la misma función; luego `r = min + rng() * range` por bucket (`0.7–1.1`, `1.1–1.5`, `1.5–2.0`).
   - `o`: `0.10 + rng() * 0.20`.
   - `rng = mulberry32(0x4E4F444F)` (misma semilla del artefacto), consumido por punto en el orden: fracción de `r`, luego `o`; los cuotas de `tone`/bucket no consumen `rng`. Documentar el orden en un comentario del módulo.
   - Implementar `mulberry32` local (8 líneas, sin dependencias) en `sky.ts`.
4. **Render**: `circle` con `cx={`${p.x}%`}`, `cy={`${p.y}%`}`, `r={p.r}`, `opacity={p.o}`, clase de tone. Sin `viewBox` (supuesto 1).
5. **Si aparece `check-mock.mjs`/mock v2 con valores por punto**: reemplazar la regla por la transcripción literal (los artefactos mandan); dejar constancia en el comentario del módulo.

### 7.2.3 Materialización de chispas (T1.3)

6. **Copiar byte-identical**: `docs/design/experience-intro/sparks.json` → `src/lib/experience/sky-sparks.json`. No editar valores ni formato.
7. **Tipar en `sky.ts`** (mismo módulo, importa el JSON): exportar `interface SkySpark { index: number; leftPct: number; topPct: number; sizePxDesktop: number; sizePxMobile: number; opacity: number; rotationDeg: number; tone: 'gold' | 'gold-soft'; twinkle: boolean; twinkleDelaySec: number | null; visibleMobile: boolean; mobileOverride: { leftPct: number; topPct: number } | null }` y `const SKY_SPARKS: readonly SkySpark[]` (11 entradas, orden del archivo).
8. **Template**: un `<span>` por entrada con las clases `--{index}`, `--twinkle` cuando `twinkle === true`, `--mobile-hidden` cuando `visibleMobile === false`, y `data-spark-index`. La capa TS solo decide banderas/orden; no calcula geometría.
9. **Clases CSS**: una regla `.experience-sky__spark--N` por índice con `left`, `top`, `--s` (`sizePxDesktop`), `--o` (`opacity`), `--r` (`rotationDeg`) y `background` según `tone`, exactos del JSON; en `@media (max-width: 800px)` una regla por índice visible con `--s: sizePxMobile px` (valores ya calculados del JSON), `--mobile-hidden { display: none }` y el `mobileOverride` de `#7` (`left: 88%; top: 33%`). En `@media (prefers-reduced-motion: no-preference)` la animación de `--twinkle` y los delays explícitos `#1 −2.4s` / `#7 −5.1s`; `#5` **sin** `animation-delay` (null del JSON → default 0 s, intencional).
10. **Prueba de paridad (obligatoria)**: el e2e lee `src/lib/experience/sky-sparks.json` y compara cada índice contra el DOM (posición relativa al sky, `width/height`, `opacity`, rotación) más visibilidad mobile, override de `#7` y ausencia de `animation-delay` en `#5`. Cualquier drift falla la suite.
11. **Prohibido duplicar/editar valores a mano**: si el diseño cambia, se re-copia el JSON y se ajusta la paridad; `sparks.json` sigue siendo la fuente única (D18).

### 7.3 Contrato de motion

> Regla transversal: solo `transform` y `opacity`. `quickTo` escribe `x`/`y`/`rotation`; el scrub escribe `yPercent`/`scale`/`opacity`; la salida escribe `xPercent`. Nunca `width/height/top/left/filter/box-shadow` en lo nuevo.

#### 7.3.1 Pointer parallax (desktop: `(pointer: fine)` **y** `innerWidth > 800`)

Módulo nuevo `src/lib/motion/pointerParallax.ts`:

```ts
export interface PointerParallaxOptions {
  clockImg: HTMLElement;
  sparks: HTMLElement;
  dust: HTMLElement;
}
export interface PointerParallaxHandle {
  /** F2: true = setters a 0 y bloqueo de input; false = re-armar. */
  setReleased(released: boolean): void;
  destroy(): void;
}
export function createPointerParallax(options: PointerParallaxOptions): PointerParallaxHandle | null;
```

- Guardas de creación: reduced motion ya viene filtrado por `initHomeExperience`; además, si `!matchMedia('(pointer: fine)').matches || innerWidth <= 800` → `null` (sin listener).
- Setters (creados una sola vez) — **amplitudes v5**:

| Target | Propiedad | Divisor | Duración / ease |
|---|---|---|---|
| `clockImg` | `x`, `y` | `(clientX − w/2) / 15`, `(clientY − h/2) / 15` (sin cambios) | 1 s, `power2.out` |
| `sparks` | `x`, `y` | `/ 32` (v5; era `/ 50`) | 1 s, `power2.out` |
| `sparks` | `rotation` | `(clientX − w/2) / 2000` deg (v5; era `/ 3000`) | 1 s, `power2.out` |
| `dust` | `x`, `y` | `/ 40` (v5; era `/ 65`) | 1.5 s, `power2.out` |
| `dust` | `rotation` | `(clientX − w/2) / 2600` deg (v5; era `/ 4000`) | 1.5 s, `power2.out` |

- Listener único `pointermove` con `{ passive: true }`, sin `preventDefault`; cada evento recalcula guardas y llama setters (no se recrean listeners; “created once”).
- **Release (F2/D11/D20)**: `setReleased(true)` envía todos los setters a `0` una sola vez y bloquea las actualizaciones por evento; `setReleased(false)` re-arma. El cruce lo detecta `homeExperience` en el `onUpdate` del `introTl`, no este módulo. Mientras `released`, cualquier `pointermove` se ignora (sin escrituras).
- Cleanup: remover listener y matar los tweens de cada setter (`setter.tween?.kill()`, con fallback `gsap.killTweensOf([clockImg, sparks, dust])`).
- No hay listener de `resize`: la guarda se re-evalúa por evento (cruce de breakpoint en runtime fuera de alcance).

#### 7.3.2 Device tilt (mobile: `(pointer: coarse)` **y** `innerWidth <= 800`) — DESIGN_SPEC §1.2–§1.4

Módulo nuevo `src/lib/motion/deviceTilt.ts`:

```ts
export interface DeviceTiltTargets { clockImg: HTMLElement; sparks: HTMLElement; dust: HTMLElement; }
export interface DeviceTiltLabel { root: HTMLElement; } // <p data-experience-tilt role="status" hidden>
export interface DeviceTiltHandle {
  /** homeExperience la llama UNA vez al completar la entry timeline. */
  arm(): void;
  /** F2: true = setters a 0 y bloqueo de input; false = re-armar. */
  setReleased(released: boolean): void;
  destroy(): void;
}
export function createDeviceTilt(
  targets: DeviceTiltTargets,
  label: DeviceTiltLabel | null,
): DeviceTiltHandle | null;
```

**Estados v5 — pipeline automático, sin controles (DESIGN_SPEC §1.1)**

| Estado | Condición / trigger | Movimiento | UI |
|---|---|---|---|
| `unsupported` | no existe `DeviceOrientationEvent` (o API inutilizable) | off | ninguna |
| `auto` | existe el evento y `requestPermission` **no** es función (Android) | on tras la entrada | ninguna |
| `pending` | existe `requestPermission`; el intento de carga rechazó (`NotAllowedError` sin gesto / rechazo no final) | off | ninguna (retry armado) |
| `prompt-unknown` | `requestPermission()` resolvió algo que no es `granted`/`denied` (`'prompt'`, `'default'`, `undefined`, string desconocido) | off | ninguna (retry armado) |
| `requesting` | llamada en vuelo (intento de carga o retry por gesto) | off | ninguna |
| `granted` | resolvió `'granted'` | se arma al completar la entrada (o de inmediato si ya completó) | ninguna |
| `denied` | **solo** resolvió `'denied'` | off | **label visible** (§7.2, §7.4) |

- **Intento de carga**: al crear el módulo (después de la detección de capacidad y de las guardas coarse/≤800/reduced) llamar `requestPermission()` **una sola vez**. iOS Safari lo rechaza con `NotAllowedError` (sin activación transitoria) → `pending`; builds de Chromium que ya exponen la API pueden resolver `'prompt'`/desconocido → `prompt-unknown`.
- **F1 — nunca denegación por resultado no final**: `'prompt'`, `'default'`, `undefined`, strings desconocidos y cualquier rechazo que no sea la resolución `'denied'` se tratan como retryables; **no** muestran label ni copy de error.
- **Retry one-shot por gesto**: desde `pending`/`prompt-unknown`, armar listeners pasivos y auto-removentes para el primero de `pointerdown`, `touchstart`, `wheel`, `scroll`, `keydown`; al dispararse, remover los cinco y llamar `requestPermission()` una vez (`requesting`). Si esa llamada tampoco termina en `granted`/`denied`, el pipeline termina en silencio para esta carga (no hay tercer intento ni label).
- **Tras denegación resuelta**: no hay reintento en la misma carga; la próxima carga ejecuta otra vez el intento de carga (interpretación autoritativa de “la próxima oportunidad”, §5 supuesto 9).
- **Memoria**: estado module-scoped, una vez por carga de página, en memoria; **sin storage**. El diseño lo describe en `homeExperience.ts`; en este repo vive en `deviceTilt.ts` creado una vez por carga (misma semántica).
- **Android** (`requestPermission` no es función): `auto`, sin UI; se arma al completar la entrada, sin llamada de permiso.
- **Reduced motion**: `createDeviceTilt` devuelve `null` (el init entero sale antes): nunca llama, nunca escucha, el label nunca se muestra.
- **Label**: se muestra solo en `denied` y con la entrada completa (si la denegación resuelve después de la entrada, se muestra de inmediato; si resuelve antes, se muestra al llamar `arm()`). Solo JS alterna `hidden`; el SSR nace `hidden`.

**Pipeline de sensores**

- Evento único: `deviceorientation` (nunca `deviceorientationabsolute` ni `webkitCompassHeading`; `requestPermission(true)`/`absolute: true` quedan descartados porque pedirían magnetómetro en iOS).
- Ejes: `beta` = inclinación adelante/atrás; `gamma` = inclinación izquierda/derecha (positivo = lado derecho abajo). `alpha` sin uso.
- Mapeo: `dx = gamma − gamma0` → **x**; `dy = beta − beta0` → **y** (el contenido sigue la inclinación).
- Baseline: media de las **primeras 8 muestras válidas** (≤ 320 ms) → `beta0`, `gamma0`; se recaptura al reanudar (visibilidad/orientación/vuelta al tope de scroll).
- Normalización por eje: `n = clamp((|d| ≤ 1.5 ? 0 : d) / 25, −1, 1)` (deadzone 1.5°, fondo de escala ±25°).
- Low-pass: EMA `s = s + 0.2 * (n − s)` por evento (α = 0.2, ~80 ms; eventos ~60 Hz).
- Amplitudes (D8/D21, **v5**):

| Target | x | y | rotation | Tween |
|---|---|---|---|---|
| `clockImg` | `n_x · min(24, 0.062 · innerWidth)` px (sin cambios) | `n_y · 14` px (sin cambios) | — | 1 s, `power2.out` |
| `sparks` | **48 %** de la x del reloj (era 30 %) | **48 %** de la y | `n_x · 0.45°` (era 0.30°) | 1 s, `power2.out` |
| `dust` | **36 %** (era 23 %) | **36 %** | `n_x · 0.34°` (era 0.22°) | 1.5 s, `power2.out` |

  Lectura de referencia v5: 390×844 → reloj ±24.0/±14.0, chispas ±11.5/±6.7, polvo ±8.6/±5.0; 360×640 → ±22.3/±14.0, chispas ±10.7/±6.7, polvo ±8.0/±5.0.
- Compensación de orientación (fórmula exacta del design):

  ```ts
  const a = ((screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI) / 180;
  const nx = dx * Math.cos(a) + dy * Math.sin(a);
  const ny = -dx * Math.sin(a) + dy * Math.cos(a);
  ```

  Portrait (a = 0) es la identidad testeada. Landscape queda **fuera del contrato de no-oclusión** y el signo de la rotación está `unverified` en dispositivo real (flip de una línea si la QA muestra inversión).
- Pausa/reanudación (D10):
  - `IntersectionObserver` sobre `[data-experience-intro]`: fuera de viewport → liberar offsets a 0 e ignorar muestras; al volver → re-baseline y reanudar.
  - `visibilitychange`: `document.hidden` → igual pausa; visible → re-baseline.
  - Cambio de orientación (`screen.orientation` `'change'` u `orientationchange`): re-baseline.
- Start (D7): el listener `deviceorientation` se adjunta solo cuando `arm()` (entrada completa) y el estado es `granted`/`auto`; un grant a mitad de la intro arma al completar. Hasta entonces no hay listener.
- **F2/D11/D20**: `setReleased(true)` pone todos los setters a 0 y bloquea muestras; `setReleased(false)` re-arma. El cruce de `0.003` lo detecta `homeExperience` en el `onUpdate` del `introTl`.
- Cleanup: remover los listeners de gesto si siguen armados (si dispararon, ya se auto-removieron), `deviceorientation`, listeners de orientación y `visibilitychange`, `disconnect()` del observer, cancelar timer pendiente, matar tweens y poner offsets a 0.
- Privacidad: sin terceros, sin red; el stream se procesa en página.

#### 7.3.3 Deriva de scroll (dentro del `introTl` existente, sin tercer ScrollTrigger)

Agregar al timeline ya creado en `homeExperience.ts`, con los nodos opcionales del cielo y el label:

```ts
if (dust) {
  introTl.to(dust,   { yPercent: -3, duration: 65, immediateRender: false }, 0);
  introTl.to(dust,   { scale: 1.025, duration: 85, immediateRender: false }, 0);
}
if (sparks) introTl.to(sparks, { yPercent: -7, duration: 70, immediateRender: false }, 0);
if (sky)    introTl.to(sky,    { opacity: 0, duration: 30, immediateRender: false }, 35);
if (tiltLabel) introTl.to(tiltLabel, { opacity: 0, duration: 8 }, 0); // D15: se retira con el hint
```

- Polvo: `yPercent −3` en 0–65 %; `scale 1 → 1.025` en 0–85 %.
- Chispas: `yPercent −7` en 0–70 %.
- Cielo completo: `opacity → 0` en 35–65 % (cae junto con el velo, que ya hace `opacity: 0` a posición 35, duración 30).
- Label de denegación: `opacity → 0` en 0–8 % (mismo bloque que el hint; DESIGN_SPEC §1.1.1).
- Nada de esto crea `ScrollTrigger` propio.

#### 7.3.4 Salida del título (reemplaza el ejemplo de §22) — DESIGN_SPEC §2

Eliminar los dos tweens actuales (15 / 17.5, con `opacity`, `y`, `letterSpacing`) y reemplazar por la forma exacta del design:

```ts
// was: { opacity: 0, y: -40, letterSpacing: '0.06em' } @15 and @17.5
introTl
  .to(titleLines[0], { xPercent: -120, duration: 25, immediateRender: false }, 15)
  .to(titleLines[1], { xPercent:  120, duration: 25, immediateRender: false }, 15);
```

- Ambas líneas arrancan en 15 y completan en 40 (15 + 25), sin stagger; línea 1 hacia la izquierda, línea 2 hacia la derecha. `ease` hereda el default del timeline (`none`, scrub lineal).
- **Sin** `opacity`, **sin** `letterSpacing`, **sin** `y`. El drift vertical de la referencia queda rechazado con evidencia medida (DESIGN_SPEC §2/§12: clearance negativa en los 5 presets).
- ±120 (no ±100) porque las líneas tienen `padding-inline`: medido, línea 1 derecha = −37.5 px (1440) / −30 px (360); línea 2 izquierda = viewport + 59 px (1440) / +39 px (360).
- Se aplica el cambio de posición de la línea 2: 17.5 → 15.
- Reversibilidad total por ser scrub; `overflow: hidden` del viewport contiene el desplazamiento.

#### 7.3.5 Aterrizaje del reloj en el dock (55–85 %, v6) — DESIGN_SPEC §13.2

Reemplaza el dissolve (era `scale 0.28, opacity 0, filter blur(2px)`, posición 55) por un tween function-based sobre el **wrapper** `[data-experience-clock]`, en la **misma posición 55** del `introTl` (la ventana §22 55–85 se preserva):

```ts
// was: .to(clock, { scale: .28, opacity: 0, filter: 'blur(2px)', duration: 30 }, 55)
const LANDED_SCALE = window.matchMedia('(max-width: 800px)').matches ? 0.3 : 0.32;
const dock = introSection.querySelector<HTMLElement>('[data-experience-dock]');
const dockCenter = () => {
  const r = dock?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 };
};

introTl.to(
  clock,
  {
    x: () => dockCenter().x - window.visualViewport.width / 2,
    y: () =>
      dockCenter().y -
      window.visualViewport.height / 2 +
      0.00687 * clock.offsetWidth * LANDED_SCALE,
    yPercent: 0,
    scale: LANDED_SCALE,
    rotation: 0,
    duration: 30, // 55 → 85 %
    immediateRender: false,
    ease: 'none',
  },
  55,
);
```

- **Sin `opacity`, sin `filter`, sin Flip**: el reloj queda **visible y nítido al 100 %**. El dissolve 55–85 de §22 queda superseded (§8, §13.5 del design).
- Targets medidos en runtime: `getBoundingClientRect()` del dock + `clock.offsetWidth`; `invalidateOnRefresh: true` (ya presente en el `introTl`) recalcula en resize. Fallback defensivo: si el dock no existe, usar 0 (el tween no rompe).
- `LANDED_SCALE` = 0.32 desktop / 0.30 mobile (matchMedia o function values equivalentes).
- El `+ 0.00687 × width × scale` compensa que el centro del bbox visible está levemente por encima del centro del elemento (fracciones de `clock-bbox.json`: centro visible al 48.775 % de la altura).
- **Geometría medida (referencia del design, para los tests)**: alto visible del reloj = `0.5407 × elementWidth × scale`; 1440×900 → 99.7 px; 1440×700 → 86.1; 1280×650 → 79.9; 390×844 → 50.6; 360×640 → 46.7. En el settle (85 y 100 %) el centro visible coincide con el centro del dock (±2 px), `scale ≈ 0.32/0.30`, `opacity 1`, `filter: none`; convergencia monótona desde 55 %.
- **Interacción con inputs**: puntero/gyro permanecen liberados por F2 durante el scrub y solo escriben sobre la `<img>`; el wrapper es propiedad exclusiva del scrub. El reloj aterrizado queda estático. Si `window.visualViewport` es `null`, usar `innerWidth`/`innerHeight` como fallback.

### 7.4 Permission UX + a11y (v5 — DESIGN_SPEC §1.1/§1.1.1)

- **Sin controles**: no hay botón, ni elemento enfocable, ni `[data-experience-tilt-ask]` en ninguna parte. El OS dialog (iOS) es la única superficie de consentimiento.
- **Pipeline**: intento de carga automático + retry one-shot por gesto (§7.3.2). El usuario nunca toca un control nuestro.
- **Label de denegación** (único UI, no interactivo):
  - Semántica: `<p class="experience-tilt" data-experience-tilt role="status" hidden>`; `pointer-events: none`; sin `tabindex`; el texto se anuncia por `aria-live` implícito de `role="status"` (polite).
  - Copy exacto (ES): título **“Viví la experiencia completa”** (uppercase por CSS, `.62rem`, tracking `.18em`, cream) + hint **“Habilitá el acceso a movimiento y orientación en Ajustes › Safari y volvé a entrar.”** (`.58rem`, stone al 80 %). El hint es deliberado: iOS no re-muestra el prompt solo, así que la recuperación honesta es Ajustes + recargar; el label no debe sugerir “tocar para arreglar”.
  - Placement: centrado, justo encima del hint “Scroll ↓”, misma ancla: `bottom: calc(clamp(1.5rem, 4svh, 3rem) + 1.75rem)`.
  - Visibilidad: solo en `denied` + entrada completa (o inmediata si la denegación resuelve después de la entrada); nunca en reduced motion; nunca en desktop (el pipeline no corre). Se retira con el hint (opacity → 0 en 0–8 %, D15).
- **Retirado en v5 (intencional)**: el ask v3, su confirmación por `role="status"` y la línea de privacidad. Una línea de privacidad sin ask sería ruido; el label reemplaza toda la UI.
- **A11y**: el label no entra al orden de tabulación ni recibe foco; su texto es real y legible; contraste con tokens (cream sobre night; stone 80 % sobre night). No se requiere `aria-describedby` (no hay control).
- **Memoria**: module-scoped, solo página actual; sin storage; tras denegación resuelta no hay reintento en la carga (la próxima carga vuelve a intentar).
- **Android**: auto-start al completar la entrada, sin UI ni llamada de permiso.
- **Reduced motion**: nunca se llama a `requestPermission`, nunca se adjunta listener y el label nunca se muestra (el init entero sale antes).
- **Secure context**: `deviceorientation` y `requestPermission()` son secure-context-only (MDN) → producción debe ser HTTPS (localhost exento). **Riesgo de deployment explícito.**

### 7.5 Contrato de no-occlusiones + constantes

**Constantes exactas (`clock-bbox.json`)**

- Canvas `reloj.png`: 1672×941; umbral alfa α ≥ 16; bbox visible en px: `x 370→1300`, `y 7→910` (931×904).
- Fracciones exactas del box de la `<img>`:
  `x0 = 0.22129186602870812`, `x1 = 0.77811004784689`,
  `y0 = 0.007438894792773645`, `y1 = 0.9681190223166843`.
  En px: `left = rect.left + rect.width * x0`, `right = rect.left + rect.width * x1`, `top = rect.top + rect.height * y0`, `bottom = rect.top + rect.height * y1`.
- Geometría CSS aprobada (§7.2): desktop gap `clamp(12rem, 52svh, 34rem)`, clock `clamp(18rem, 40vw, 42rem)` / `calc(40svh * (1672/941))`; mobile gap `clamp(7.5rem, 34svh, 16rem)`, clock `min(80vw, 24rem)` / `calc(32svh * (1672/941))`.

**Contrato**

En todo estado soportado —inicial, extremos de puntero, extremos de gyro, scrub 0–75 % y salida del título— se cumple:

1. Los **CSS boxes** de `.experience-intro__line` no intersectan el bbox visible del reloj (separación ≥ 0 px).
2. La **tinta** de cada línea (rects de `Range` sobre el contenido) mantiene ≥ **8 px** de separación del bbox visible del reloj.

> **v5**: el aumento de amplitud de estrellas no afecta este contrato. El reloj conserva su presupuesto (`/15` en puntero y `±min(24, 6.2vw)/±14` en gyro) y sparks/dust son capas decorativas sin relación con la oclusión de títulos (DESIGN_SPEC §1.3/§3). La evidencia medida de abajo sigue vigente porque el movimiento del reloj no cambió.

**Evidencia medida del diseño (referencia para el test)**

| Viewport | Peor top (box/ink, px) | Peor bottom (box/ink, px) | ¿Con tilt? |
|---|---|---|---|
| 1440×900 | 45.2 / 84.2 | 51.3 / 38.2 | no (solo puntero) |
| 1440×700 | 21.6 / 60.6 | 26.7 / 13.5 | no |
| 1280×650 | 19.4 / 54.4 | 25.5 / 14.8 | no |
| 390×844 | 28.0 / 45.0 | 31.3 / 24.3 | sí, ±1 ambos signos |
| 360×640 | 15.3 / 32.3 | 18.6 / 12.3 | sí |

Fallback font (Times New Roman forzada): mínimo box 19.4 px / ink 16.7 px → pass. Drift del asset 0 px; overflowX 0 en los 5 presets; 0 errores de consola/página. Matriz completa: `check-mock.mjs` (no copiado; ver §10).

**Salida lateral (v4)**: solo `xPercent` deja las relaciones verticales intactas; los márgenes medidos en t 0.15→0.40 crecen (desktop top ≥ 79.7 px, bottom ≥ 76.8 px; mobile peor ink 23.1 px a 360×640). Trayectoria: a 20 % las líneas llevan −24 / +24 % y siguen en pantalla; a 40 % línea 1 derecha = −37.5 px y línea 2 izquierda = viewport + 59 px (1440), ≥ 30 px de margen en todos los presets.

**Aterrizaje (v6)**: a partir de 55 % el reloj viaja al dock. Las líneas del título ya están fuera del viewport desde 40 % (`xPercent ±120`), por lo que **no puede haber intersección**; el chequeo debe **gatear la medición con un flag de on-screen** (si la línea no está en viewport, no se mide) para que 0.65/0.75 sigan siendo válidos. Estados añadidos: `0.85` y `1.0` (settle) con las aserciones del dock (§7.3.5/C3), y verificación de overflow en todo el rango 55–100 %.

**Estados mínimos del chequeo automatizado**

- Progreso del scrub: `0`, `0.05`, `0.10`, `0.15`, `0.20`, `0.275`, `0.35`, `0.40`, `0.50`, `0.65`, `0.75`, `0.85`, `1.0`.
- Puntero (desktop): centro, `(0,0)`, `(w−1,0)`, `(0,h−1)`, `(w−1,h−1)` con asentamiento previo.
- Gyro (mobile): `setGyro(±1, ±1)` en las 4 combinaciones de signo a t = 0 (DESIGN_SPEC §8) + reposo.
- Viewports obligatorios: 1280×720, 1440×900, 390×844 y 360×640 (los dos últimos son los del design con tilt); recomendados además 1440×700, 1280×650 y 1920×1080.
- Antes de medir: `await document.fonts.ready` y asentamiento de transformaciones (dos lecturas estables, tolerancia 0.5 px).

**Factibilidad**: Playwright/Chromium puede leer `getBoundingClientRect()` de la imagen transformada y de cada línea (incluye transforms de GSAP), construir los rects de tinta con `Range`, y comparar con las constantes. No requiere capturas ni medición de fuentes web (el proyecto no self-hostea fuentes). El scroll se dirige con `window.scrollTo` (Lenis sincroniza el scroll nativo) y se espera con `expect.poll`; no se necesitan hooks de test.

### 7.6 Contrato no-JS / reduced motion

- **Sin JS**: el cielo (150 círculos + 11 chispas), título, reloj, dock (invisible), hint y film se ven; el label `.experience-tilt` queda `hidden`; ningún elemento crítico con `opacity: 0`; título en `xPercent 0`; polvo/chispas estáticos; el film muestra el stack del velo y el overlay queda en `opacity: 0` (sin video).
- **Reduced motion** (`prefers-reduced-motion: reduce`): `initHomeExperience` sale antes de todo, por lo que:
  - no hay `gsap.set` oculto, ni scrub, ni Lenis; el reloj queda en su posición base (no hay aterrizaje) y el dock vacío no genera overflow;
  - no se crean `pointerParallax` ni `deviceTilt`; `requestPermission` nunca se llama; el label nunca se revela; ningún listener;
  - el twinkle no corre (`@media (prefers-reduced-motion: no-preference)`); el film queda estático con el stack del velo;
  - los tests existentes de reduced motion siguen verdes **sin cambios** (título y reloj sin `opacity`/`transform` inline).
- **Sin JS y con JS**: el HTML SSR no contiene estados ocultos críticos; lo que oculta el `introTl` se aplica solo por GSAP.

### 7.7 Performance budgets

- **Dependencias**: 0 nuevas (`package.json`/`pnpm-lock.yaml` sin diff).
- **Timelines con ScrollTrigger**: exactamente 2 (grep `scrollTrigger:` en `homeExperience.ts` → 2). El cielo no agrega.
- **Propiedades animadas nuevas**: `transform` (`x`, `y`, `rotation`, `xPercent`, `yPercent`, `scale`) y `opacity` únicamente.
- **Loops**: 0 `rAF` propios; todo corre en el ticker de GSAP existente.
- **Listeners**: 1 `pointermove` (desktop), 1 `deviceorientation` (mobile, solo tras armar), 1 `visibilitychange`, 1 `IntersectionObserver`, 1 listener de orientación, y hasta 5 listeners de gesto **transitorios** del retry one-shot (se auto-remueven al primer gesto o en cleanup); todos pasivos. El twinkle es CSS.
- **DOM**: ≈ 176 nodos del cielo (150 círculos + 11 chispas + contenedores) + 2 del label (`__title`, `__hint` dentro de un `<p>`) + 1 nodo dock vacío, SSR; mobile oculta 75 círculos y 3 chispas por CSS (siguen en DOM). Por frame: 2 transforms de capas del cielo + transform del reloj + opacidades + ≤ 3 twinkles; todo compuesto. **v6 quita** el tween de opacidad/scale del viewport del film, así que no se anima ninguna capa extra.
- **Overlay del film**: transición CSS de `opacity` 0.4 s, disparada una sola vez por `data-video-ready` cuando el video real tenga metadatos; sin costo por frame.
- **Red**: el SVG de máscara se pide on-demand (CSS), **no** se preloadea; `reloj.png` conserva `fetchpriority="high"` y debe seguir siendo el LCP (verificación manual).
- **CLS**: 0 esperado (capas absolutas); `reloj.png` mantiene `width`/`height`.
- **Frame budget**: handlers O(1) sin lecturas de layout por evento; `quickTo` reutiliza sus tweens.
- **Bundle**: sin chunk vendor nuevo; el polvo/chispas no agregan JS de cliente (el enriquecimiento ocurre en build).

### 7.8 Docs updates (tarea T4.1)

Edición mínima de `docs/NODO — Home Experience - Fase 01.md`:

1. **§12**: párrafo nuevo: capa `.experience-sky` decorativa (polvo + chispas, DOM/SVG, sin canvas ni assets nuevos) que se desvanece con el velo (35–65 %).
2. **§17**: valores aprobados (desktop `clamp(18rem, 40vw, 42rem)` + `max-width: calc(40svh * (1672/941))`; mobile `min(80vw, 24rem)` + `max-width: calc(32svh * (1672/941))`) con nota de que forman parte del contrato de no-oclusión.
3. **§22, bloque 15–40 %**: reemplazar el ejemplo de salida por la salida lateral aprobada (`xPercent ∓120`, 15→40, sin stagger, sin fade) y aclarar que el ejemplo anterior queda superseded por decisión explícita del usuario (2026-09-10).
4. **§22 (nota de upgrade)**: breve párrafo sobre tilt de puntero/gyro, **pipeline automático de permiso (sin controles) y label de denegación “Viví la experiencia completa”**, la continuidad v6 y el aterrizaje del reloj, con puntero a `docs/design/experience-intro/DESIGN_SPEC.md` y a este spec. **Corrección puntual obligatoria**: la nota v4 ya escrita en el working tree (§22, “Nota de upgrade v4 (cielo + tilt)”) menciona “con control de permiso «Activar movimiento» en iOS”; reemplazar esa frase por “con pipeline automático de permiso (sin controles) y label de denegación en iOS”.
5. **§22 (línea “El reloj desaparece”, ~línea 867)**: agregar la nota de supersesión v6 — el reloj ya no se disuelve; aterriza en el dock (55–85 %) y queda visible y nítido al 100 %. Las ventanas de §22 (20–55 transform, 55–85 landing) se preservan; solo cambia el contenido de 55–85.
6. **§53 (“Estado conceptual final de la secuencia”, “[reloj desaparece]”)**: misma supersesión — el estado final es “el reloj aterriza en el dock y permanece visible”, no “desaparece”.
7. **§56 (criterios visuales / continuidad espacial)**: agregar la referencia de que el criterio de continuidad ahora se cumple con la alineación de fondos de v6 (film fallback = stack del velo; delta de píxel ≤ 2/canal en el muestreo), con puntero a DESIGN_SPEC §13.1.
8. `pnpm format` normaliza el Markdown; no reescribir el resto.

### 7.9 Contrato de continuidad intro → film (v6) — DESIGN_SPEC §13.1

**Objetivo**: que el revelado 35–65 % no muestre ninguna costura: el fondo compuesto debe ser exactamente el del velo en todo el rango.

**Cambios respecto de v5** (los tres focos del salto percibido):

| Fuente | v5 (actual) | v6 (objetivo) |
|---|---|---|
| Fondo del film | `radial green .44` + `gold .08` + `linear-gradient(#071311 → #0b201c 56% → #071311)` | **stack exacto del velo**: `radial-gradient(circle at 50% 46%, rgb(13 63 55 / .28), transparent 46%)`, `radial-gradient(circle at 86% 88%, rgb(201 167 67 / .06), transparent 30rem)`, `var(--nodo-night)` plano (sin banda media) |
| Opacidad del viewport del film | tween 0 → 1 en 35–65 % (dos capas semitransparentes → bleed del body, dip a mitad del fade) | **constante 1** (queda detrás del velo; solo el velo hace fade 35–65) |
| Scale del panel | `scale 1.04 → 1` en 35–65 % | **eliminado** (sin transform del panel) |
| Overlay (green .35 top / night .6 bottom) | siempre visible | **`opacity: 0` hasta que un video real tenga metadatos**; pasa a 1 con `0.4 s ease` cuando el guard del video dispara |

**Implementación**

- `ScrollFilm.astro`: el `background` de `.scroll-film__viewport` se reemplaza por el stack del velo (valores de la tabla; **fuente de verdad = el velo de `ExperienceIntro.astro`** — si cambia, el film lo copia). El overlay nace `opacity: 0` y la regla `[data-video-ready] .scroll-film__overlay { opacity: 1; transition: opacity 0.4s ease; }` (o `:where()` equivalente) conmuta cuando el film section/viewport lleva `data-video-ready`.
- `homeExperience.ts`: eliminar `gsap.set(filmViewport, { opacity: 0, scale: 1.04 })` de la entrada, el tween `introTl.to(filmViewport, { opacity: 1, scale: 1, … }, 35)`, y el `filmViewport` de `hiddenNodes` (ya no hay estado oculto que revertir). El velo sigue `introTl.to(veil, { opacity: 0, duration: 30 }, 35)`.
- El guard del video (`loadedmetadata` → `createFilmScrub`) agrega `filmSection.dataset.videoReady = ''` (idempotente) antes/después de crear el scrub; sin video no hay atributo y el overlay queda en 0. En fallo (`error`) no se agrega.
- **Video futuro**: el backdrop del film se mantiene detrás del video real (doble como póster), el overlay queda gateado a video-present y se retuna solo contra frames reales; sin cambios al stack (§13.1 del design lo documenta como decisión futura).

**Criterio medible**

- **C1 (computed styles)**: el stack computado de `.scroll-film__viewport` (`backgroundImage` + `backgroundColor`) es igual al del `.experience-intro__veil`; `opacity` del viewport del film = `1`; sin `transform` en el panel; overlay `opacity: 0` sin video.
- **C2 (render)**: píxel muestreado 1×1 con `page.screenshot({ clip: … })` en el centro del viewport (o el punto del design) a t `0.34`, `0.50`, `0.66` difiere ≤ **2 por canal** del velo en reposo (referencia `rgb(7, 19, 17)`), en los 5 presets.
- Sin overflow horizontal en el revelado; sin cambios en las ventanas de tiempo (veil 35–65, §23 intacto).

### 7.10 Contrato del asset de drink (v6, spec-only) — DESIGN_SPEC §13.3

**Estado**: el asset **no existe**. No se escribe markup hasta que exista; esta sección fija el contrato para el swap futuro.

- **Master**: único **PNG-24 lossless, straight alpha, sRGB** (IEC61966-2.1 embebido), sin sombra/reflejo horneados, sin matte (sin fringe blanco/negro), sin watermark ni EXIF. Long side **≥ 960 px** (3× del tamaño CSS mayor), desde fuente retocada a 2–3×.
- **Producción**: `<picture>` con **AVIF q60–70** + **WebP q85–92** + **PNG fallback**; `srcset` @1x/@2x.
- **Framing**: vaso completo recortado, centrado y vertical; **6–8 % de margen transparente** en los cuatro lados (espacio para sombra); sin recorte de borde/pie; luz cálida de borde que combine con el reloj sobre `#071311`.
- **Tamaños** (derivados del dock): desktop @1x long side **300 px**, @2x **600 px**; mobile @1x **150 px**, @2x **300 px**. Presupuestos: @1x AVIF ≤ 25 kB, WebP ≤ 45 kB, PNG ≤ 120 kB; @2x ≤ 2×.
- **Markup futuro** (dentro del dock, cuando exista el asset):

  ```astro
  <picture class="experience-dock__drink">
    <source type="image/avif" srcset="/experience-drink.avif 1x, /experience-drink-2x.avif 2x" />
    <source type="image/webp" srcset="/experience-drink.webp 1x, /experience-drink-2x.webp 2x" />
    <img
      src="/experience-drink.png"
      srcset="/experience-drink-2x.png 2x"
      width="300"
      height="400"
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      fetchpriority="low"
    />
  </picture>
  ```

  (`width`/`height` = proporción real del master elegido, no inventar; nunca candidato a LCP — el reloj conserva `fetchpriority="high"`.)
- **Composición futuro**: vaso vertical centrado en el box; base del vaso sobre el borde inferior del dock; el reloj descansa centrado sobre el centro del dock (detrás/por encima de la base del vaso); safe area = box ±10 %; sombra del drink por CSS igual a la del reloj: `filter: drop-shadow(0 2rem 4rem rgb(0 0 0 / .42)) drop-shadow(0 0 3rem rgb(201 167 67 / .08))`.
- **Naming**: `public/experience-drink.png` (+ `-2x`; el nombre final se confirma con el asset elegido).
- **QA de entrega**: alpha fringe sobre `#071311` a 1× (sin halos), sin banding en dorados, nitidez 2× (bordes del vaso), sin fondo/watermark horneados, margen 6–8 %, perfil sRGB, presupuestos cumplidos, temperatura de color comparable con `reloj.png`.

## 8. Conflictos y reconciliaciones

| Punto | Fuentes | Resolución |
|---|---|---|
| §22 15–40 %: fade/uplift/letter-spacing | Producto vs design v4 | **Superseded** por decisión explícita del usuario; design §2 manda; doc actualizado (T4.1). |
| Split de tono del polvo: “78 % cream / 22 % stone” | DESIGN_SPEC §5 vs `particles.json.stats` (114/36 = 76/24) | Adoptar el **JSON** (dato realizado con la semilla). La diferencia de 2 puntos es la distribución efectiva del mock; deja de ser contrato la prosa. |
| Valores por punto de `r`/`opacity`/`tone` | `particles.json` trae solo `[x,y]`; el design difiere “particle specs” a v2 | Reconstrucción determinista D2/§7.2.2 (rangos y conteos de los artefactos); si aparece el generador, transcribir. |
| Tabla de chispas por índice | Handoff previo vs `DESIGN_SPEC.md` §5 (solo rangos) | **RESUELTA**: `sparks.json` es la fuente única (D18/§7.2.3). La spec previa tenía valores inventados que se corrigen: halo `inset:-150%`/`rgb(228 199 122/.26)`, twinkle `8s cubic-bezier(.45,0,.55,1)`, ocultamiento mobile `[3,9,11]` (no `[9,10,11]`), y `#5` sin `animation-delay`. |
| Fila `unsupported` de §1.1 incluye “no requestPermission`” | DESIGN_SPEC §1.1 vs §1.1 (android-auto) | Resuelto: `unsupported` = sin `DeviceOrientationEvent`; Android = evento sin `requestPermission` → auto-start (supuesto 4). |
| Ask v3 (botón) vs requisito del usuario (v5) | `DESIGN_SPEC.md` v3 vs v5 §1.1/§1.1.1 | **Superseded**: sin botones. Pipeline automático + retry one-shot por gesto; único UI = label de denegación no interactivo. |
| Nombre/markup del control | v3 (`__ask`/`__note`/`__status`) vs spec previa (`experience-intro__consent`) vs v5 | Adoptar v5: `experience-tilt` + `data-experience-tilt` con `__title`/`__hint`; sin botón, sin `aria-busy` y sin nodo de estado separado (el `role="status"` es el propio label). Copy: “Viví la experiencia completa” + hint de Ajustes. |
| F1 — resultados no finales de `requestPermission()` | v4 spec mapeaba `prompt` como estado propio y los rechazos como `denied` | v5 manda: `'prompt'`/`'default'`/`undefined`/desconocido/rechazo no-final = retryable (`pending`/`prompt-unknown`); **nunca** label ni copy de error; solo `'denied'` resuelto deniega. |
| F2 — release por umbral | v4 spec liberaba en el próximo evento de input | v5 manda: `setReleased(true/false)` invocado desde el `onUpdate` del `introTl` en el cruce de 0.003, sin input; los eventos solo se ignoran mientras `released`. |
| Amplitudes de estrellas | v4 spec `/50`–`/65`, 30/23 % | v5 manda: puntero sparks `/32`+rot `/2000`, dust `/40`+rot `/2600`; gyro sparks 48 %+rot 0.45°, dust 36 %+rot 0.34°. **Reloj intacto** (contrato de no-oclusión sin cambios). |
| Re-arm del release | Design §1.4/§6 (“re-armed below 0.003”) vs supuesto previo `<0.001` | Adoptar umbral único 0.003 del design; se elimina el 0.001 inventado. |
| Compensación de orientación | Design §1.2 fórmula exacta vs tabla switch previa | Adoptar la fórmula `cos/sin`; landscape fuera de contrato y signo a validar en QA. |
| `r` del polvo | DESIGN_SPEC §5 “0.7–2.0 px” vs spec previa `r %` | Adoptar **px** con SVG sin `viewBox`; círculos redondos. |
| Fade del label | DESIGN_SPEC §1.1.1 (se retira con el hint) | D15: incluir el label en el tween 0–8 % del `introTl`. |
| Dissolve del reloj 55–85 % (`scale 0.28`, `opacity 0`, `blur(2px)`) | Producto §22/§53 (“el reloj desaparece”) vs v6 §13.2 | **Superseded**: el reloj **aterriza** en el dock y queda visible/nítido al 100 % (D23/§7.3.5). Las ventanas §22 se preservan; doc actualizado (T4.1). |
| Fallback del film / opacidad 0→1 / `scale 1.04→1` | v5 (D1/N4) vs v6 §13.1 | **Superseded** por la continuidad: fondo = stack del velo, opacidad constante 1, sin transform de panel (D22/§7.9). |
| Overlay del film siempre visible | v4/v5 vs v6 §13.1 | v6: `opacity: 0` hasta video real con metadatos → 1 (0.4 s ease). Sin video, nunca aparece. |
| Continuidad §56 (“sin cambio de sección evidente”) | Producto §56 vs v6 | Satisfecha por la alineación de fondos (film = velo; delta de píxel ≤ 2/canal); se agrega la referencia en el doc (T4.1). |
| Drink | No existe asset vs v6 §13.3 | Spec-only: contrato fijado (§7.10); sin markup hasta que el asset exista (D24). |
| Open questions del design §10 | Pacing portrait, fade residual, tablets > 800 | No bloqueantes; defaults adoptados (supuesto 6). |
| §60/§61/§62/§47/§2 | Producto | Cumplidos: transform/opacity, 2 timelines, sin “moon”, sin grain nuevo, sin deps/WebGL. |

## 9. Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Deriva entre clases CSS de chispas y `sparks.json` | Media | Bajo | Copia byte-identical + prueba de paridad (T5.1/T5.3): cualquier diferencia falla la suite. |
| HTTPS ausente en deploy → sensores iOS muertos y sin prompt | Media | Alto | Verificar HTTPS en el dominio final; QA en preview HTTPS; documentar en la entrega. |
| Reconstrucción de `r`/`o`/`tone` difiere del mock original | Media | Bajo | Regla determinista acotada por rangos/conteos; reemplazable si aparece `check-mock.mjs`; el polvo es decorativo. |
| Signos de sensores/compensación mal calibrados (landscape) | Media | Medio | QA manual en dispositivo real (iOS + Android, portrait y ambos landscape); flip de una línea. |
| `mask` con SVG grande en 11 elementos (paint cost) | Baja | Medio | Medir paint/long tasks en DevTools; si es caro, reducir tamaño (no cambiar el enfoque sin aprobación). |
| Flakiness del test de no-oclusión por Lenis/scrub | Media | Medio | `expect.poll` con estabilidad de rects; sin snapshots; tolerancia 0.5 px; estados acotados. |
| Colisión de propiedades GSAP (entrada/scrub vs input) | Baja | Medio | Tilt sobre `img`, scrub sobre el div; capas con propiedades disjuntas; release por cruce (F2). |
| El label de denegación se muestra en un caso no previsto | Baja | Medio | Gate por estado (§7.3.2) + `hidden` SSR + tests por estado (desktop/Android/`'prompt'`/reject/denied/granted). |
| El retry one-shot se consume en un evento sin activación transitoria (p. ej. `scroll` en iOS) | Baja | Medio | En un gesto táctil real `pointerdown`/`touchstart` preceden a `scroll`, así que el primer evento es de activación; QA manual en iPhone debe confirmar el orden y, si no, reordenar la lista de eventos (cambio acotado, sin reabrir diseño). |
| Fuga de listeners del retry por gesto | Baja | Bajo | Auto-remoción de los cinco listeners al primer evento + remoción en cleanup; test de conteo de listeners. |
| Twinkle vs reduce (animación residual) | Baja | Bajo | Keyframes dentro de `@media (prefers-reduced-motion: no-preference)`; test de computed style. |
| Cambios de geometría rompen el overflow existente | Baja | Medio | El clip del viewport contiene `xPercent ±120`; correr la suite completa. |
| El muestreo de píxeles de continuidad es flaky (perfil de color, antialias, frame a mitad de fade) | Media | Medio | C1 por computed styles es la aserción primaria; C2 (píxel 1×1, ≤2/canal) es secundaria con espera de estabilidad y viewport fijo; correr en Chromium con `--force-color-profile=srgb` si hiciera falta. |
| Medición del dock desactualizada tras resize | Baja | Medio | Function values + `invalidateOnRefresh` del `introTl`; el test puede forzar un `resize` + refresh y re-medir el settle. |
| El film se ve antes de tiempo si el velo dejara de ser opaco | Baja | Alto | El velo usa `var(--nodo-night)` plano como capa base opaca; la continuidad exige que siga siendo el fondo del velo. Si se cambiara, actualizar ambos lados (contrato C1). |
| El overlay queda en 0 sin video (esperado) pero podría quedar en 0 con video si el guard no dispara | Baja | Medio | `data-video-ready` se setea en `loadedmetadata` de forma idempotente; test con un `<video>` stub o verificación manual cuando llegue el material. |
| El asset de drink no existe → dock vacío | Alta | Bajo | Es el estado aprobado (spec-only); el contrato queda listo para el swap futuro (D24/§7.10). |
| Doc de producto desincronizado | Baja | Medio | T4.1 obligatoria antes del cierre. |

## 10. Open questions

1. **RESUELTAS — inputs de diseño**: los cuatro artefactos (`DESIGN_SPEC.md`, `particles.json`, `clock-bbox.json`, `sparks.json`) están en repo y verificados por hash. No quedan bloqueantes.
2. **No bloqueantes del design (defaults adoptados, §5 supuesto 6)**: pacing del exit en portrait (ventana única de 25), sin fade residual, tablets > 800 px sin tilt.
3. **Decisiones documentadas (no son preguntas)**:
   - `sparks.json` codifica `twinkleDelaySec: null` en el índice 5 porque la fuente no declara `animation-delay`; el CSS no debe emitir la propiedad (default 0 s). Es intencional y no se rellena.
   - v5 no reintenta dentro de la misma carga tras una denegación resuelta; “la próxima oportunidad” = próxima carga de página (el intento de carga se repite). El label indica Ajustes + volver a entrar, que es la única vía real en iOS.
   - El retry por gesto es **one-shot**: un segundo resultado no final termina el pipeline en silencio (sin label, sin más llamadas). Si en QA real el primer gesto no es de activación, se reordena la lista de eventos (cambio acotado).
   - **v6 drink**: el asset no existe; el dock queda vacío y el swap es una tarea futura con el contrato de §7.10 (no bloquea nada).
   - **v6 video futuro**: cuando llegue el video real, revisar el gating del overlay (hoy `opacity: 0` sin video) y el backdrop del film; el stack de continuidad queda como default (DESIGN_SPEC §13.1/§13.5).

No hay preguntas bloqueantes. `check-mock.mjs` y `check-index.mjs` no son necesarios para implementar (sus resultados ya están volcados en DESIGN_SPEC §3/§12 y en `sparks.json`), pero serían útiles como oráculo del polvo y de la matriz de no-oclusión.

## 11. Tareas atómicas

Convención: cada tarea indica objetivo, archivos, dependencias, done-when y validación. “Inspección” = revisión estática del diff (la hace `reviewer`).

### F0 — Inputs de diseño

- **T0.1 (resuelta) — Artefactos base en repo.** `DESIGN_SPEC.md` + `particles.json` + `clock-bbox.json` copiados byte-identical (hashes verificados). ✔
- **T0.2 (resuelta) — Tabla de chispas en repo.** `sparks.json` disponible en `docs/design/experience-intro/` (6.954 B; sha256 `7fcb2df7…3377`). ✔

### F1 — Cielo (DOM + datos + estilos)

- **T1.1 Polvo determinista (datos + render)** — *desbloqueada*
  - Objetivo: copiar `particles.json` → `src/lib/experience/sky-dust.json` (byte-identical) y crear `src/lib/experience/sky.ts` con `SkyDustPoint`, `SKY_DUST` (150) y la regla de reconstrucción de `r`/`o`/`tone` de §7.2.2; renderizar con `.map()` sobre `<circle>` (`cx`/`cy` %, `r` px, `opacity`).
  - Archivos: `src/lib/experience/sky-dust.json` (nuevo), `src/lib/experience/sky.ts` (nuevo), `src/components/home/ExperienceIntro.astro`.
  - Depende: T0.1 (hecha).
  - Done-when: 150 `<circle>` SSR en el orden del archivo; 114 `--cream` + 36 `--stone`; `r ∈ [0.7, 2.0]`; `o ∈ [0.10, 0.30]`; sin `set:html`; sin `style=""`.
  - Validación: `pnpm check`; e2e “sky structure” (T5.1); inspección.
- **T1.2 Estilos del cielo (máscara + polvo)**
  - Objetivo: CSS scoped del cielo (§7.2): capa, máscara de gradiente, dots cream/stone, ocultamiento `nth-of-type(2n)` ≤ 800 px.
  - Archivos: `src/components/home/ExperienceIntro.astro` (style).
  - Depende: T1.1.
  - Done-when: `mask-image` computada presente; 75 círculos visibles a 390 px.
  - Validación: e2e (T5.1); `pnpm build`.
- **T1.3 Chispas (datos + markup + máscara + halo + twinkle)** — *desbloqueada*
  - Objetivo: copiar `sparks.json` → `src/lib/experience/sky-sparks.json` (byte-identical); tipar `SkySpark`/`SKY_SPARKS` en `sky.ts`; renderizar los 11 `<span>` con `--twinkle`/`--mobile-hidden`/`data-spark-index`; materializar las clases `--N` de §7.2.3 con los valores exactos del JSON (máscara, halo, twinkle y delays incluidos).
  - Archivos: `src/lib/experience/sky-sparks.json` (nuevo), `src/lib/experience/sky.ts`, `src/components/home/ExperienceIntro.astro`.
  - Depende: T0.2 (hecha) + T1.1 (módulo).
  - Done-when: 11 spans SSR; 8 visibles ≤ 800 px con `[3,9,11]` ocultos; máscara `url('/nodo_logo_vector_flat.svg')`; twinkle solo `[1,5,7]` y solo sin reduce; `#1 −2.4s`, `#7 −5.1s`, `#5` sin `animation-delay`; override `#7` mobile `left 88% / top 33%`; prueba de paridad vs JSON en verde.
  - Validación: e2e (T5.1/T5.3); inspección.
- **T1.4 Label de denegación (markup + estilos; sin ningún control; retiro del ask v4 si existe)** — *desbloqueada*
  - Objetivo: implementar el único UI de permiso v5: `<p class="experience-tilt" data-experience-tilt role="status" hidden>` con `__title` “Viví la experiencia completa” y `__hint` “Habilitá el acceso a movimiento y orientación en Ajustes › Safari y volvé a entrar.”; CSS no interactivo (`pointer-events: none`, layout con `:not([hidden])`); **si el working tree ya tiene el ask v4** (`.experience-tilt__ask/__note/__status`, `[data-experience-tilt-ask]`, `aria-busy`, foco a `[data-experience-intro]`), eliminarlo por completo (markup, estilos y lógica de foco), junto con `tabindex="-1"` de la sección y `.experience-intro:focus`.
  - Archivos: `src/components/home/ExperienceIntro.astro`.
  - Depende: —.
  - Done-when: HTML SSR con `hidden`; **cero** `<button>`, cero `[data-experience-tilt-ask]`, cero `aria-busy`, cero elementos `tabindex >= 0` en el intro; copy exacto; `pnpm lint` sin quejas.
  - Validación: `pnpm check` + `pnpm lint`; e2e (T5.1/T5.3).
- **T1.5 Dock de aterrizaje (nodo + CSS)** — *desbloqueada*
  - Objetivo: agregar `<div class="experience-dock" data-experience-dock aria-hidden="true"></div>` después del reloj y su CSS de §7.2 (`left 50% / top 74% / translate(-50%,-50%)`, `pointer-events: none`, `--dock-w/--dock-h` 106×300 desktop y 54×150 mobile, sin estilo visual).
  - Archivos: `src/components/home/ExperienceIntro.astro`.
  - Depende: —.
  - Done-when: nodo SSR vacío y decorativo; sin foco; sin overflow en 390 y 1440; paint order incluye `dock` después de `clock`.
  - Validación: e2e dock (T5.6); inspección.

### F2 — Geometría

- **T2.1 Valores de no-oclusión**
  - Objetivo: aplicar row-gap y anchos de reloj desktop/mobile aprobados (§7.2/§7.5).
  - Archivos: `src/components/home/ExperienceIntro.astro`.
  - Depende: —.
  - Done-when: valores exactos presentes; font clamps intactos; sin overflow nuevo.
  - Validación: e2e de no-oclusión (T5.4) + test de overflow existente.

### F3 — Motion

- **T3.1 Deriva de scroll del cielo y retiro del label en `introTl`**
  - Objetivo: agregar los tweens de §7.3.3 dentro del `introTl` existente (nodos opcionales/defensivos), incluido el label de tilt en el fade 0–8 %.
  - Archivos: `src/lib/motion/homeExperience.ts`.
  - Depende: T1.1–T1.4.
  - Done-when: grep `scrollTrigger:` = 2; tweens con `immediateRender: false`; propiedades solo `yPercent/scale/opacity`.
  - Validación: e2e scrub (T5.2); inspección.
- **T3.2 Salida lateral del título**
  - Objetivo: reemplazar los tweens 15/17.5 por la forma exacta de §7.3.4 (`xPercent ∓120`, posición 15, duración 25).
  - Archivos: `src/lib/motion/homeExperience.ts`.
  - Depende: —.
  - Done-when: sin `opacity`/`letterSpacing`/`y` en la salida; ambas a posición 15; completa a 40.
  - Validación: e2e salida (T5.2); tests existentes verdes.
- **T3.3 Módulo pointer parallax (amplitudes v5 + `setReleased`)**
  - Objetivo: crear `src/lib/motion/pointerParallax.ts` según §7.3.1: setters con `clock /15`, `sparks /32` + rot `/2000`, `dust /40` + rot `/2600`; handle con `setReleased(boolean)` (F2) y `destroy()`; montarlo en `homeExperience` con `clockImg`, `sparks`, `dust`.
  - Archivos: `src/lib/motion/pointerParallax.ts` (nuevo), `src/lib/motion/homeExperience.ts`.
  - Depende: T1.1–T1.3.
  - Done-when: guardas fine/>800; divisores/duraciones exactos de §7.3.1; un listener pasivo; `setReleased(true)` deja los tres targets en `translate(0px, 0px)` y bloquea updates; `setReleased(false)` re-arma; cleanup en `disposers`.
  - Validación: e2e pointer/amplitudes/F2 (T5.2); inspección.
- **T3.4 Módulo device tilt (pipeline automático v5 + label; reemplaza la lógica v4 si existe)**
  - Objetivo: crear/reescribir `src/lib/motion/deviceTilt.ts` según §7.3.2/§7.4: intento de carga único, retry one-shot por gesto, F1, estados v5, `arm()` en `entry.onComplete`, label en `denied`, amplitudes v5 (48 %/36 %, rot 0.45°/0.34°), `setReleased(boolean)`, pausa/re-baseline y cleanup; montarlo en `homeExperience` con `label: { root }` cuando exista. Si el working tree ya tiene la versión v4 (estados `undecided`/`granted con click`/`denied por cualquier error`, UI de ask, `getProgress`), **reemplazarla**, no convivir con ella.
  - Archivos: `src/lib/motion/deviceTilt.ts` (nuevo/modificado), `src/lib/motion/homeExperience.ts`.
  - Depende: T1.4.
  - Done-when: una sola llamada de carga sin input; retry one-shot con auto-remoción; no-final nunca deniega ni muestra label (F1); Android sin UI; label solo en `denied` + entrada completa; pipeline de sensores exacto (8 muestras ≤320 ms, ±25°, deadzone 1.5°, clamp, EMA 0.2); cleanup completo (incluye listeners de gesto si no dispararon y offsets a 0).
  - Validación: e2e de estados/retry/label (T5.3); QA manual (T6.2).
- **T3.5 Hook F2 en `homeExperience.ts` `onUpdate`**
  - Objetivo: en el `onUpdate` del `introTl`, comparar `self.progress > 0.003` contra el estado previo; en el cruce llamar `setReleased(true)` en los handles de pointer y gyro (setters a 0 y bloqueo de input) y `setReleased(false)` al cruzar hacia abajo; sin esperar eventos de input.
  - Archivos: `src/lib/motion/homeExperience.ts`.
  - Depende: T3.3, T3.4.
  - Done-when: cambiar el progreso a 0.01 sin ningún input deja clockImg/sparks/dust en `translate(0px, 0px)`; volver a 0 y despachar pointer/sensor restaura offsets; flag propio en el closure, sin listeners nuevos.
  - Validación: e2e F2 (T5.2/T5.3); inspección.
- **T3.6 Aterrizaje del reloj en el dock (reemplaza el dissolve 55–85)**
  - Objetivo: reemplazar el tween `scale 0.28 / opacity 0 / filter blur(2px)` de la posición 55 por el tween function-based de §7.3.5 (`x/y` al centro del dock vía `getBoundingClientRect`, `yPercent 0`, `scale 0.32/0.30`, `rotation 0`, `duration 30`, `immediateRender: false`, `ease none`), sin `opacity`/`filter`; eliminar del `introTl` el dissolve viejo (no dejar tweens duplicados).
  - Archivos: `src/lib/motion/homeExperience.ts`.
  - Depende: T1.5.
  - Done-when: en 0.85/1.0 el centro visible del reloj coincide con el del dock (±2 px), `scale ≈ 0.32/0.30`, `opacity 1`, `filter none`; convergencia monótona desde 0.55; sigue habiendo 2 `ScrollTrigger`; sin overflow.
  - Validación: e2e landing (T5.6); inspección.
- **T3.7 Continuidad intro→film (backdrop, opacidad, scale, overlay)**
  - Objetivo: en `ScrollFilm.astro`, reemplazar el fondo del viewport por el stack exacto del velo y dejar el overlay en `opacity: 0` con la regla `[data-video-ready]` (0.4 s ease); en `homeExperience.ts`, quitar el `gsap.set(filmViewport, { opacity: 0, scale: 1.04 })`, el tween `opacity 1/scale 1` de 35 % y `filmViewport` de `hiddenNodes`; setear `filmSection.dataset.videoReady = ''` (idempotente) cuando el guard de `loadedmetadata` dispare.
  - Archivos: `src/components/home/ScrollFilm.astro`, `src/lib/motion/homeExperience.ts`.
  - Depende: —.
  - Done-when: computed stack del film = computed stack del velo; opacidad del film = 1 en todo progreso; sin transform de panel; overlay 0 sin video; sin regresión de `overflowX` ni del scrub del film; 0 errores de consola.
  - Validación: e2e continuidad (T5.5); inspección.

### F4 — Docs

- **T4.1 Actualización mínima del doc de producto**
  - Objetivo: editar §12, §17, §22, §53 y §56 como en §7.8: nota de supersesión del ejemplo de salida; nota de upgrade v5 (pipeline automático + label, sin controles); **supersesión v6 “el reloj desaparece” → aterriza en el dock y permanece visible (§22 y §53)**; referencia a §56 (continuidad satisfecha por la alineación de fondos). **Si la nota v4 ya escrita en el working tree menciona «Activar movimiento»/control, corregir esa frase** (queda obsoleta por v5).
  - Archivos: `docs/NODO — Home Experience - Fase 01.md`.
  - Depende: —.
  - Done-when: diff acotado a esas secciones; sin reescritura; `pnpm format:check` verde.
  - Validación: inspección + `pnpm format`.
- **T4.2 Drink (placeholder spec-only; sin código)**
  - Objetivo: no escribir markup mientras el asset no exista. Dejar el contrato de §7.10 como referencia y, cuando el asset llegue, agregar el `<picture>` dentro del dock con AVIF/WebP/PNG, `srcset` 1x/2x, dimensiones explícitas, `loading="lazy"`, `decoding="async"`, `fetchpriority="low"`, `aria-hidden`, `alt=""` y el drop-shadow del reloj.
  - Archivos: ninguno ahora (futuro: `src/components/home/ExperienceIntro.astro`, `public/experience-drink.*`).
  - Depende: asset inexistente (no bloquea el resto).
  - Done-when (de esta tarea): contrato documentado y aceptado; **ningún** `<img>`/`<picture>` de drink en el código.
  - Validación: inspección.

### F5 — Tests e2e

- **T5.1 Estructura y contratos del cielo**
  - Objetivo: nuevo `tests/e2e/home-experience-sky-tilt.spec.ts` con: sky `aria-hidden` y `pointer-events: none`; 150 circles; 114 cream / 36 stone; `r`/`o` en rango; 75 visibles a 390 px; 11 sparks / 8 visibles con `[3,9,11]` ocultos; máscara computada; halo `::before`; twinkle solo `[1,5,7]`; `#7` override mobile; `#5` sin `animation-delay`; **paridad de los 11 índices contra `sky-sparks.json`**; sin `style=""`; sin `<link rel=preload>` de la máscara.
  - **Sin controles**: `[data-experience-tilt]` es un `<p role="status" hidden>` sin `<button>`, sin `[data-experience-tilt-ask]`, sin elementos `tabindex >= 0`; `pointer-events: none`; copy exacto del label.
  - Depende: T1.1–T1.4.
  - Validación: `pnpm test:e2e`.
- **T5.2 Pointer, amplitudes v5, F2 y salida lateral**
  - Objetivo: asertar amplitudes v5 en esquinas y centro (`S1`: sparks ≈ ±22.5 px y rot ≈ 0.36° a 1440; dust ≈ ±18.0 px y rot ≈ 0.28°), `setReleased` por cruce **sin input** con `translate(0px, 0px)` exacto y re-armado tras volver a 0 (F2); salida con `tx < 0` / `tx > 0`, opacidad 1 en 15–40 % (E1–E3); deriva del cielo en 0–75 %; reversibilidad; overflow ≤ 0 en t 0.20/0.30/0.40 (E5).
  - Depende: T3.1–T3.3, T3.5.
  - Validación: `pnpm test:e2e`.
- **T5.3 Permission pipeline automático + label + gyro v5**
  - Objetivo: contexts mobile con `addInitScript` por estado: `granted`/`denied` (`Promise.resolve`), no-final `'prompt'` (F1) y rechazo (`NotAllowedError`), ausente (Android) y sin `DeviceOrientationEvent`; espía `window.__calls` para: **una** llamada de carga sin input, **una** llamada extra en el primer gesto, auto-remoción de los cinco listeners, segunda falla sin más llamadas; no-button/focusable; label solo en `denied` + entrada completa con copy exacto y `pointer-events:none`; eventos sintéticos de `DeviceOrientationEvent` (baseline 8, deadzone, clamp, `S2`: sparks 11.52 px / dust 8.64 px a 390, 10.71/8.04 a 360); orientación con `Object.defineProperty(screen.orientation, 'angle', …)`; `requestPermission` nunca llamado en reduced motion; F2 con gyro (`setReleased` sin input).
  - Depende: T3.4, T3.5.
  - Validación: `pnpm test:e2e`; QA real (T6.2).
- **T5.4 No-oclusión (incluye landing v6)**
  - Objetivo: helper de geometría + casos de §7.5 en 1280×720, 1440×900, 390×844 y 360×640 (más los recomendados), con progreso, extremos de puntero y `setGyro(±1, ±1)` en 4 combinaciones; CSS boxes ≥ 0 px e ink ≥ 8 px (**G8/E4**); agregar `0.85`/`1.0` con **gate de on-screen** (las líneas fuera de viewport no se miden) y sin overflow en 55–100 %; el presupuesto del reloj no cambia por v5/v6.
  - Depende: T2.1, T3.3, T3.4, T3.6.
  - Validación: `pnpm test:e2e`.
- **T5.5 Continuidad intro→film (C1/C2)**
  - Objetivo: asertar computed styles del film = computed styles del velo (`backgroundImage` + `backgroundColor`), opacidad del viewport del film = 1, sin `transform` de panel, overlay `opacity: 0` sin video; y **muestreo de píxel 1×1** (`page.screenshot({ clip: { x, y, width: 1, height: 1 } })` en el centro) a t 0.34/0.50/0.66 con delta ≤ 2 por canal contra `rgb(7, 19, 17)` en los 5 presets; sin overflow.
  - Depende: T3.7.
  - Validación: `pnpm test:e2e`.
- **T5.6 Dock + aterrizaje (C3/C4/C6)**
  - Objetivo: assert `[data-experience-dock]` decorativo (`aria-hidden`, `pointer-events: none`, sin foco, sin overflow); en 0.85/1.0 centro visible del reloj = centro del dock (±2 px), `scale ≈ 0.32/0.30`, alto visible = `0.5407 × elementWidth × scale` (±5 px), `opacity 1`, `filter none`, convergencia monótona desde 0.55; paint order `veil < sky < title < clock < dock < hint < tilt`.
  - Depende: T1.5, T3.6.
  - Validación: `pnpm test:e2e`.

### F6 — Validación y QA

- **T6.1 Suite completa + chequeos estáticos**
  - Objetivo: correr el plan de §13 y los greps de invariantes (2 ScrollTriggers, 0 “moon”, 0 `set:html`/`style=`, 0 diff de deps, máscara no preload, sin dissolve 55–85 en el código, film sin tween de opacidad/scale, dock sin foco).
  - Depende: F1–F5.
  - Validación: comandos de §13.
- **T6.2 QA manual en teléfono real**
  - Objetivo: checklist de §13.3 (HTTPS, prompt iOS, Android sin UI, signos y orientación, deadzone, re-baseline, performance) **más la continuidad 35–65 % (sin costura visible) y el aterrizaje del reloj en el dock en device**. Pendientes declarados por el design: signos reales, timing del prompt iOS, compensación landscape, HTTPS real, sensación del landing.
  - Depende: T6.1.
  - Validación: evidencia documentada en la entrega.
- **T6.3 Cierre**
  - Objetivo: reporte de archivos, decisiones, validaciones, riesgos y diferencias vs el diseño; nada fuera de alcance.
  - Depende: T6.2.

## 12. Criterios de aceptación

Cada grupo es verificable por comando, test o inspección. Las etiquetas G1–G9/S1/S2/F2/E1–E5 (v5/v4) y C1–C7 (v6) son las del design (trazabilidad).

**A. Estructura y a11y**

1. `[data-experience-sky]` existe una vez, `aria-hidden="true"`, `pointer-events: none`, entre `__veil` y `h1`; polvo con atributos de presentación SVG, sin `set:html` (DESIGN_SPEC §4).
2. 150 `<circle>` SSR en orden de archivo, 114 cream / 36 stone; 75 visibles a ≤ 800 px; `r ∈ [0.7, 2.0]` px; `o ∈ [0.10, 0.30]` (T5.1).
3. 11 `<span>` de chispas SSR y 8 visibles a ≤ 800 px, con `[3,9,11]` ocultos (`--mobile-hidden`); máscara computada con `nodo_logo_vector_flat.svg`; halo `::before` (`inset:-150%`, `rgb(228 199 122 / .26)`); twinkle solo `[1,5,7]` con `8s cubic-bezier(.45,0,.55,1)`; `#1 −2.4s`, `#7 −5.1s`, `#5` sin `animation-delay`; override `#7` mobile `left 88% / top 33%`; `data-spark-index` presente en los 11 (T5.1/T5.3).
4. Sin `style=""` ni `set:html` en lo nuevo; sin `is:inline` (grep + inspección).
5. **G1 — sin control interactivo**: no hay `<button>`, ni `[data-experience-tilt-ask]`, ni elementos con `tabindex >= 0` en el intro; el único DOM de tilt es el label `<p role="status" hidden>` con `pointer-events: none`, sin foco. Copy exacto: “Viví la experiencia completa” + “Habilitá el acceso a movimiento y orientación en Ajustes › Safari y volvé a entrar.”
6. **G2 — intento de carga automático**: con `requestPermission` presente, init lo llama exactamente una vez sin interacción; sin la API (Android) → estado `auto`, movimiento armado tras la entrada, sin llamada y sin UI.
7. **G3 — F1 resultados no finales**: `'prompt'`, `'default'`, `undefined`, strings desconocidos y rechazos que no sean `'denied'` nunca producen `denied` ni label; quedan retryables y arman el retry por gesto.
8. **G4 — retry one-shot por gesto**: el primero de `pointerdown`/`touchstart`/`wheel`/`scroll`/`keydown` dispara exactamente una llamada extra; los cinco listeners se auto-remueven; `granted` arma movimiento, `denied` muestra el label; un segundo fallo no vuelve a llamar ni muestra label.
9. **G5 — label de denegación**: solo un `'denied'` resuelto lo muestra; copy exacto, `role="status"`, `pointer-events: none`, sin focusable; oculto en reduced motion y en desktop; visible con la entrada completa (o de inmediato si la denegación resuelve después); se desvanece con el hint (0–8 %).

**B. Sin JavaScript**

10. Con `javaScriptEnabled: false`: h1, reloj y film visibles; opacidad 1 en los críticos; 150 círculos presentes; el label `.experience-tilt` queda `hidden` (test existente + T5.1).

**C. Reduced motion**

11. **G6**: con `reducedMotion: 'reduce'`: sin clases `lenis`; título y reloj sin `opacity`/`transform` inline (test existente); **`requestPermission` nunca se llama**, no hay listeners, el label nunca se muestra; `animation-name` del twinkle = `none` (T5.1/T5.3).

**D. Valores de motion**

12. **G7 — arming**: el listener de sensores se adjunta solo con grant (o Android `auto`) **y** entrada completa; un grant a mitad de la intro arma al completar (T5.3).
13. Pointer + **S1**: reloj `/15` sin cambios; sparks `/32` + rot `/2000`; dust `/40` + rot `/2600`; a 1440 en la esquina → sparks ≈ ±22.5 px / 0.36°, dust ≈ ±18.0 px / 0.28° (±0.05); duraciones 1 / 1 / 1.5 s `power2.out`; un `pointermove` pasivo (T5.2 + inspección).
14. Gyro + **S2**: baseline 8 muestras (≤320 ms); `n = clamp((|d| ≤ 1.5 ? 0 : d)/25, −1, 1)`; EMA α=0.2; reloj `min(24, 0.062·vw)` / 14 px **sin cambios**; sparks **48 %** + rot `n·0.45°`; dust **36 %** + rot `n·0.34°`; a 390 → 11.52 / 8.64 px, a 360 → 10.71 / 8.04 px (±0.05); compensación `cos/sin`; solo `deviceorientation`; un listener pasivo (T5.3 + QA).
15. **F2 — release por cruce**: con puntero extremo y gyro a full tilt, llevar el progreso a 0.01 **sin despachar ningún input** deja clock/sparks/dust en `translate(0px, 0px)` exacto; volver a 0 y despachar de nuevo restaura los offsets; el release se invoca desde el `onUpdate` del `introTl` (cruce de 0.003), no desde los handlers de input (T5.2/T5.3).
16. **G9 — desktop intacto**: en `(pointer: fine)` o ancho > 800 el pipeline nunca llama a `requestPermission`, nunca escucha, no hay label, y un `deviceorientation` despachado no produce transform (T5.3).
17. Scrub: `dust yPercent −3` (0–65) + `scale 1.025` (0–85); `sparks yPercent −7` (0–70); `sky opacity 0` (35–65); label a `opacity 0` (0–8); **el dissolve 55–85 (`scale 0.28`/`opacity 0`/`blur`) queda reemplazado por el aterrizaje al dock (§12.29–30)**; todo dentro del `introTl`; 2 `ScrollTrigger` en total (T5.2 + grep).
18. Salida: **E1** a 0.20/0.30 línea 1 negativa y línea 2 positiva, ambas parcialmente en pantalla; **E2** a 0.40 ambas fuera con ≥ 8 px (línea 1 derecha ≤ 0; línea 2 izquierda ≥ ancho de viewport); **E3** sin `opacity`/`letterSpacing` en 15–40 %, opacidad computada 1 (T5.2).
19. **E5 — sin overflow durante el exit**: `scrollWidth − innerWidth ≤ 0` en t 0.20/0.30/0.40 (T5.2).

**E. No-oclusión general**

20. **G8/E4/criterio de §7.5**: el chequeo pasa en todos los estados y viewports listados, con las constantes exactas de `clock-bbox.json`; a 390×844 y 360×640 el tilt completo en ambos signos da line box ≥ 0 e ink ≥ 8 px con los offsets de reloj y estrellas de §12.14; se agregan `0.85`/`1.0` con **gate de on-screen** (las líneas fuera de viewport no se miden) y sin overflow en 55–100 % (T5.4).
21. El test de overflow horizontal existente sigue verde en desktop y mobile.

**F. Presupuestos**

22. Cero dependencias nuevas; sin Three/WebGL; sin timelines extra; solo `transform`/`opacity` nuevos; sin segundo grain; `reloj.png` conserva `fetchpriority="high"` y sin `loading="lazy"`; la máscara no se preloadea (T6.1).

**G. Tests existentes, docs y datos**

23. `home-experience.spec.ts` y `smoke.spec.ts` verdes sin modificaciones (T6.1).
24. Doc de producto actualizado en §12/§17/§22/§53/§56 con la nota de supersesión (salida y “el reloj desaparece”), la nota v5 del pipeline/label y la referencia de continuidad v6 (T4.1).
25. `src/lib/experience/sky-dust.json` y `src/lib/experience/sky-sparks.json` son byte-identical a sus artefactos (hash/estructura) y sin ediciones manuales (inspección + diff).
26. **Paridad de chispas**: el e2e lee `src/lib/experience/sky-sparks.json` y verifica contra el DOM los 11 índices (left/top relativos al sky, tamaño desktop/mobile, opacidad, rotación, tone), la visibilidad mobile y el override de `#7`; cualquier drift falla (T5.1/T5.3).

**H. Continuidad y aterrizaje v6 (C1–C7)**

27. **C1 — continuidad (computed)**: el stack computado de `.scroll-film__viewport` (`backgroundImage` + `backgroundColor`) es igual al de `.experience-intro__veil`; opacidad del viewport del film = `1`; sin `transform` en el panel; overlay `opacity: 0` sin video (T5.5).
28. **C2 — continuidad (render)**: el píxel muestreado 1×1 a t 0.34/0.50/0.66 difiere ≤ **2 por canal** del velo en reposo (`rgb(7, 19, 17)`) en los 5 presets; sin overflow (T5.5).
29. **C3 — geometría del landing**: a 0.85 y 1.0 el centro visible del reloj = centro del dock (±2 px); `scale ≈ 0.32` desktop / `0.30` mobile; alto visible = `0.5407 × elementWidth × scale` (±5 px); convergencia monótona desde 0.55 (T5.6).
30. **C4 — reloj visible al 100 %**: no corre ningún tween de `opacity`/`filter` sobre el reloj en 55–100 %; `opacity` computada 1 y `filter: none` al final del intro (T5.6).
31. **C5 — sin timelines/deps nuevos**: exactamente 2 `ScrollTrigger`; el landing es un tween modificado dentro del `introTl`; sin Flip ni plugins GSAP nuevos (grep + inspección).
32. **C6 — dock decorativo**: `[data-experience-dock]` con `aria-hidden="true"`, `pointer-events: none`, sin contenido focusable, sin overflow en ningún estado de landing; paint order incluye `dock` tras `clock` (T5.6).
33. **C7 — contrato del asset de drink**: el contrato de §7.10 (master PNG-24 sRGB ≥960 px, AVIF/WebP/PNG, tamaños 300/600 desktop y 150/300 mobile, presupuestos, carga lazy/async/width/height/fetchpriority low/alt vacío, QA de alpha) queda documentado; **no hay markup de drink en el código** mientras el asset no exista (T4.2, spec-only).

## 13. Plan de validación

### 13.1 Comandos (Windows / PowerShell / pnpm, en orden)

```powershell
pnpm format          # normaliza también el Markdown actualizado
pnpm format:check    # exit 0
pnpm check           # astro check (TS strict) exit 0
pnpm lint            # exit 0, cero warnings
pnpm build           # exit 0 (prerender de / y /styleguide)
pnpm test:e2e        # smoke + home-experience + home-experience-sky-tilt en verde
pnpm validate        # re-verifica check/lint/format:check/build
```

### 13.2 Chequeos estáticos de invariantes

```powershell
# exactamente 2 ScrollTrigger (IntroTimeline + FilmTimeline)
Select-String -Path "src\lib\motion\homeExperience.ts" -Pattern "scrollTrigger:" | Measure-Object | Select-Object -ExpandProperty Count

# prohibiciones en lo nuevo + ausencia de controles interactivos
Select-String -Path "src\components\home\ExperienceIntro.astro","src\lib\motion\pointerParallax.ts","src\lib\motion\deviceTilt.ts" -Pattern "moon|set:html|style=|is:inline|<button|data-experience-tilt-ask" -ErrorAction SilentlyContinue

# sin dependencias nuevas
git diff --stat -- package.json pnpm-lock.yaml

# el JSON del polvo es copia del artefacto (mismo hash de contenido)
Get-FileHash "docs\design\experience-intro\particles.json","src\lib\experience\sky-dust.json" -Algorithm SHA256
Get-FileHash "docs\design\experience-intro\sparks.json","src\lib\experience\sky-sparks.json" -Algorithm SHA256

# HTML construido: 150 círculos, label oculto, sin preload de la máscara
Select-String -Path "dist\client\index.html" -Pattern "<circle" -AllMatches
Select-String -Path "dist\client\index.html" -Pattern "data-experience-tilt"
Select-String -Path "dist\client\index.html" -Pattern "nodo_logo_vector_flat"

# v6: no queda dissolve ni tween de opacidad/scale del film; el dock existe una vez
Select-String -Path "src\lib\motion\homeExperience.ts" -Pattern "blur\(2px\)|scale: 1\.04|opacity: 1, scale: 1"
Select-String -Path "src\components\home\ExperienceIntro.astro" -Pattern "data-experience-dock"
Select-String -Path "src\components\home\ScrollFilm.astro" -Pattern "0b201c|data-video-ready"
```

### 13.3 QA manual en teléfono real (evidencia obligatoria)

1. **HTTPS**: servir el build en un origen HTTPS (preview de deploy). En HTTP local los sensores de iOS no funcionan: anotar el origen usado.
2. **iOS Safari (≤ 800 px) — sin botones**: al cargar no hay UI y el intento de carga falla en silencio (no aparece prompt); en el **primer gesto** (touch/scroll) debe aparecer el prompt nativo; conceder → tilt responde; denegar → aparece el label “Viví la experiencia completa” + hint de Ajustes, sin más prompts en la carga. Verificar con VoiceOver que el label se anuncia (role=status) y que no hay elementos enfocables.
3. **Reintento y siguiente oportunidad**: recargar tras denegar vuelve a intentar (iOS no re-muestra el prompt solo; si el usuario habilitó movimiento en Ajustes › Safari, la carga nueva debe conceder).
4. **Android Chrome (≤ 800 px)**: sin UI; el tilt funciona al completar la entrada.
5. **Signos y orientación**: portrait y ambos landscape; inclinar a la derecha mueve el reloj de forma intuitiva; sin inversiones; sin jitter; deadzone estable en reposo.
6. **Ciclo de vida**: background/foreground (re-baseline); scrollear fuera del intro y volver (pausa + release a 0 + re-baseline); cambio de orientación (re-baseline); sin saltos.
7. **Continuidad y aterrizaje (v6)**: scrollear despacio 30→70 % — el revelado del film no debe mostrar costura ni banda; a 55→100 % el reloj viaja al dock y termina visible/nítido, centrado en el dock, sin salto ni overflow; en mobile igual (dock 54×150).
8. **Performance**: DevTools móvil — LCP sigue siendo `reloj.png`; CLS 0; sin long tasks nuevas; memoria estable; estrellas a la nueva amplitud sin artefactos.
9. **Desktop real**: mouse a las esquinas (estrellas ~+60 % más móviles que v4: sparks ≈22.5 px, dust ≈18 px a 1440), release por cruce de scrub sin mover el mouse, re-arm al volver; sin fuga tras mucho movimiento; landing estable tras resize.

### 13.4 Casos e2e nuevos (archivo `tests/e2e/home-experience-sky-tilt.spec.ts`)

**Impacto del delta v5/v6 sobre los casos v4 (si el developer ya los hubiera empezado, se ajustan así)**:

> Estado del working tree al escribir estos deltas: ya hay implementación en curso de v4/v5 (`ExperienceIntro.astro`, `homeExperience.ts`, `ScrollFilm.astro`, `src/lib/experience/`, `deviceTilt.ts`, `pointerParallax.ts`, `tests/e2e/home-experience-sky-tilt.spec.ts`, doc de producto). Las tareas se aplican como **corrección** sobre ese trabajo (retirar ask, reescribir permiso, subir amplitudes, mover release a `onUpdate`, **continuidad del film + dock/landing + supersesión de docs**), no como creación desde cero.

- Cambian (v5): caso 3 (reduce: `requestPermission` = 0 llamadas + label `hidden`), caso 4 (divisores `/50`,`/65` → `/32`,`/40` y rotaciones `/2000`,`/2600`), caso 5 (release pasa a **F2 sin input**), caso 8 (granted deja de ser “control visible + click” y pasa a llamada automática con espía), caso 9 (denied deja de usar click y copy “Sin movimiento”; pasa a F1 + retry), caso 10 (Android sin ningún control), caso 11 (se separa G9 desktop) y el antiguo conteo de listeners pasa a ser el caso 12 ampliado.
- Cambian (v6): el **orden de pintado** que asserta el caso 1/2 pasa de `veil < sky < title < clock < hint < tilt` a `veil < sky < title < clock < dock < hint < tilt`; el caso 13 (no-oclusión) agrega `0.85`/`1.0` con gate de on-screen y sin overflow en 55–100 %; cualquier aserción del dissolve viejo (reloj `opacity 0`/`blur` al final) se elimina — el reloj queda visible.
- Se agregan: caso 12 (conteo/auto-remoción de listeners de retry), caso 13 (G8/E4 no-oclusión), **caso 14 (continuidad C1/C2)** y **caso 15 (dock + landing C3/C4/C6)**.
- **Sin cambios** en `tests/e2e/home-experience.spec.ts` y `tests/e2e/smoke.spec.ts` (deben seguir verdes tal cual; no assertan el dissolve).
- Casos 1–7 se mantienen en esencia (estructura/paridad, mobile, reduce/no-JS, S1, F2, exit, overflow), con los ajustes v5/v6 enumerados.

1. **Estructura del cielo** (desktop por defecto): attrs/aria/pointer-events; 150 circles; 114/36; `r`/`o` en rango; 11 sparks con `data-spark-index`; máscara; halo; twinkle solo `[1,5,7]` con la animación del JSON; `#5` sin `animation-delay`; sin `style=""`; sin preload de máscara; **paridad completa de los 11 índices contra `sky-sparks.json`**.
2. **Cielo mobile**: contexto `devices['iPhone 13']` → 75 circles visibles; 8 sparks visibles con `[3,9,11]` ocultos; override `#7` `left 88% / top 33%`; `--s` = `sizePxMobile` del JSON (p. ej. `#1` 12.75 px); círculos redondos (bbox ancho≈alto en un dot de muestra).
3. **Reduce y no-JS**: `reducedMotion: 'reduce'` → `animation-name: none`, sin transforms inline en capas, label `hidden`, **espía de `requestPermission` en 0 llamadas** y sin listeners; `javaScriptEnabled: false` → todo visible, 150 círculos y label `hidden`.
4. **Amplitudes de puntero (S1)**: a 1440×900, `page.mouse.move(0,0)` → reloj `(−w/2/15, −h/2/15)` ≈ (−48.0, −30.0), sparks `(−w/2/32, −h/2/32)` ≈ (−22.5, −14.1) con rotación ≈ −0.36°, dust `(−w/2/40, −h/2/40)` ≈ (−18.0, −11.3) con rotación ≈ −0.28° (tolerancia 0.05 px/0.005°); centro → 0.
5. **F2 — release sin input**: fijar un extremo de puntero y un tilt full, llevar el progreso del scrub a ~0.01 con `window.scrollTo` **sin despachar input**; `expect.poll` hasta que clock/sparks/dust lean `translate(0px, 0px)` exactos; volver a 0 y re-despachar pointer/sensor → los offsets vuelven.
6. **Salida lateral (E1–E3)**: a ~0.20 y ~0.30, `m41` de línea 1 < 0 y de línea 2 > 0, ambas parcialmente en pantalla; opacidad computada 1; sin `letter-spacing` inline; a ~0.40 |m41| ≥ ancho de viewport.
7. **Overflow del exit (E5)** y **deriva del cielo**: `scrollWidth − innerWidth ≤ 0` en 0.20/0.30/0.40; a ~0.5 `yPercent`/`scale`/`opacity` en rango; a 0.65+ `sky` opacidad 0; reversibilidad al volver a 0; el label (si estuviera visible) cae con el hint a 0–8 %.
8. **G2/G7 granted automático**: contexto mobile + `requestPermission = () => Promise.resolve('granted')` y `addInitScript` que espía `window.__calls`; assert **1 llamada sin input**; sin botón ni focusables; 8 eventos sintéticos de baseline + ~30 de estímulo → reloj con transform no nulo y acotado; sparks/dust en 48 %/36 % del reloj (S2); deadzone estable con delta < 1.5°; arming solo tras `entry` completa.
9. **G3/F1 no-final retryable**: stubs `() => Promise.resolve('prompt')` y `() => Promise.reject(new DOMException('', 'NotAllowedError'))`; assert estado sin label, sin copy de error y con retry armado; despachar `pointerdown` → exactamente 1 llamada extra; si esa segunda también es no-final → 0 llamadas ulteriores y 0 labels; los cinco listeners de gesto se auto-removieron (conteo).
10. **G4/G5 denied**: segundo intento (o primero, según stub) resuelve `'denied'`; tras el gesto → label visible con copy exacto (“Viví la experiencia completa” + hint con “Ajustes › Safari”), `role="status"`, `pointer-events: none`, sin `[data-experience-tilt-ask]`; gestos posteriores no vuelven a llamar ni cambian el label.
11. **G1/G9 sin control y desktop**: en mobile el intro no contiene `<button>` ni elementos `tabindex >= 0`; en contexto desktop (`Desktop Chrome` por defecto) el pipeline no llama (`window.__calls` = 0), no hay label y un `deviceorientation` despachado no produce transform.
12. **Conteo de listeners**: envolver `EventTarget.prototype.addEventListener` en `addInitScript` y exponer `window.__listenerCounts`; assert `pointermove ≤ 1`, `deviceorientation ≤ 1` por contexto, `visibilitychange ≤ 1`, `orientationchange ≤ 1`, y que los listeners de retry (`pointerdown`/`touchstart`/`wheel`/`scroll`/`keydown`) se remueven tras usarse.
13. **G8/E4 no-oclusión (con landing v6)**: helper de §7.5; recorre progreso (incluye `0.85`/`1.0`)/puntero/`setGyro(±1,±1)` y viewports; CSS-box gap ≥ 0 e ink gap ≥ 8 px (tolerancia 0.5 px); **gate de on-screen** para líneas fuera de viewport; sin overflow en 55–100 %; el presupuesto del reloj no cambió.
14. **Continuidad intro→film (C1/C2)**: computed stack del `.scroll-film__viewport` = computed stack del `.experience-intro__veil`; opacidad del film = 1; sin `transform` de panel; overlay `opacity: 0` sin video; **píxel 1×1** con `page.screenshot({ clip: { x, y, width: 1, height: 1 } })` en el centro a t 0.34/0.50/0.66 con delta ≤ 2/canal contra `rgb(7, 19, 17)` en los 5 presets; `scrollWidth − innerWidth ≤ 0`.
15. **Dock + landing (C3/C4/C6)**: `[data-experience-dock]` decorativo (`aria-hidden`, `pointer-events: none`, sin foco, sin overflow); paint order con `dock` tras `clock`; a 0.85/1.0 centro visible del reloj = centro del dock (±2 px), `scale ≈ 0.32/0.30`, alto visible = `0.5407 × elementWidth × scale` (±5 px), `opacity 1`, `filter none`; convergencia monótona desde 0.55.

Sensores en Playwright: primario `window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta, gamma }))`; orientación con `Object.defineProperty(screen.orientation, 'angle', { get: () => 90 })`; fallback CDP `DeviceOrientation.setDeviceOrientationOverride` vía `context.newCDPSession(page)`. El baseline se arma con 8 eventos idénticos; el estímulo se repite ~30 veces para que la EMA (α=0.2) converja y se assetan valores con `expect.poll`.

## 14. Task Contract

- **objective**: dejar implementado y verificado el upgrade del `ExperienceIntro` en su forma **v5 + v6** (cielo mixto DOM/SVG; tilt puntero/gyro con pipeline de permiso automático sin controles y label de denegación; salida lateral del título; release por cruce F2; amplitudes de estrellas v5; **continuidad intro→film por alineación exacta de fondos y overlay gateado**; **aterrizaje del reloj en el dock visible al 100 %**; contrato del drink documentado; geometría sin oclusión; doc de producto actualizado), sin dependencias nuevas y con la suite Playwright ampliada en verde.
- **success_criteria**: §12 completa (grupos A–H), comandos de §13.1 en verde, greps de §13.2 sin hallazgos prohibidos, QA manual de §13.3 documentado, diff acotado a los archivos de Auto-Forecast.
- **non_goals**: §3.
- **assumptions**: §5.
- **open_questions**: **none (bloqueante)**. Inputs resueltos y v5/v6 incorporados; las no bloqueantes del design están adoptadas con default.
- **accepted_tradeoffs**: (a) se reemplaza el ejemplo de §22 (aprobado) y el doc se edita de forma mínima; (b) memoria de permiso por página: tras denegar no hay reintento en la misma carga; la próxima carga vuelve a intentar (el label guía a Ajustes + recargar); (c) cruce de breakpoints en runtime no re-crea módulos (puntero re-evalúa por evento; gyro es de carga); (d) el SVG de máscara se pide on-demand; (e) `r`/`o`/`tone` del polvo se reconstruyen con regla determinista hasta tener `check-mock.mjs`; (f) landscape del tilt fuera del contrato de no-oclusión; (g) los valores de chispas se materializan en clases CSS (límite CSP) y se garantizan con la prueba de paridad contra `sparks.json`; (h) se retira el ask y la línea de privacidad de v3 (decisión explícita de v5); (i) las estrellas suben ~+60 % manteniendo el presupuesto del reloj y el contrato de no-oclusión; (j) la continuidad v6 se logra por **igualdad exacta de fondos** (sin capa puente nueva); (k) el dock queda vacío hasta que exista el drink (spec-only); (l) el overlay del film permanece oculto hasta que exista video real con metadatos.
- **validation**: §13.1–§13.4.
- **ask_abort_triggers**:
  1. Si un valor requerido no está en los artefactos, **no inventarlo** (incluido el asset de drink): detener y escalar.
  2. Si el chequeo de no-oclusión o el de continuidad fallan con los valores aprobados, detener y escalar con evidencia (rects/progreso/viewport o píxeles muestreados); no recalibrar por cuenta propia.
  3. Si el pipeline automático no puede funcionar sin reintroducir un control interactivo, detener: **nunca** volver al ask (requisito explícito del usuario).
  4. Si el landing requiere Flip, plugins GSAP nuevos, timelines adicionales o dependencias, detener (el diseño lo prohíbe explícitamente).
  5. Si `mask`, `quickTo` o la compensación de orientación requieren una dependencia o un cambio de API global, detener.
  6. Si aparece cualquier `style=""`/`is:inline` necesario (CSP) o se necesita tocar tokens/timeline count, detener.
  7. Si un test sólo puede pasar con snapshots visuales, replantear con DOM/geometría/píxel 1×1 y documentar (§R5).

## 15. Handoff packet

- **current objective**: implementar el upgrade del intro (v4 + deltas v5/v6) en `feat/home-experience-intro` sin commits.
- **decisions made**: §6 (D1–D24) y §8 (reconciliaciones).
- **files read / to touch**: §4 y Auto-Forecast; los cuatro artefactos de diseño leídos y verificados por hash (DESIGN_SPEC v6 incluido).
- **validation state**: no ejecutada en esta sesión (spec-only). Baseline: `6f53b0d` con los tests previos verdes. Working tree con implementación v4/v5 en curso (ver §13.4); este spec la corrige a v5+v6.
- **blockers**: **ninguno**. T0.1 y T0.2 resueltas; v5/v6 incorporados.
- **next action**: `developer` aplica los deltas sobre el trabajo en curso (F1 T1.4/T1.5 → F3 T3.3–T3.7 → F4 T4.1/T4.2 → F5 T5.1–T5.6) y luego ejecuta F1–F6 completos → `reviewer` sobre el diff.

## 16. Auto-Forecast

- **estimated_scope (total, implementación completa)**: `large` (>400 líneas no mecánicas: ~180 markup+CSS cielo/label/dock, ~140 datos+materialización, ~300 módulos de motion/landing, ~120 film, ~420 tests e2e, ~60 docs).
- **estimated_scope (delta v5)**: `medium` (~200–300 líneas sobre la base v4: pipeline de permiso + label + amplitudes + hook F2 + tests; sin archivos nuevos).
- **estimated_scope (delta v6, esta tarea)**: `medium` (~250–350 líneas: dock node/CSS + landing tween + cambios de film/overlay + continuidad y tests C1–C3 + doc; sin archivos nuevos salvo los assets futuros del drink).
- **affected_files**:
  - Nuevos: `src/lib/experience/sky.ts`, `src/lib/experience/sky-dust.json` (copia byte-identical de `docs/design/experience-intro/particles.json`), `src/lib/experience/sky-sparks.json` (copia byte-identical de `docs/design/experience-intro/sparks.json`), `src/lib/motion/pointerParallax.ts`, `src/lib/motion/deviceTilt.ts`, `tests/e2e/home-experience-sky-tilt.spec.ts`, `docs/superpowers/specs/2026-09-10-experience-intro-sky-tilt-design.md` (este documento).
  - Modificados: `src/components/home/ExperienceIntro.astro` (dock + label), `src/lib/motion/homeExperience.ts` (landing + continuidad + inputs), `src/components/home/ScrollFilm.astro` (backdrop = velo, overlay gateado, sin scale), `docs/NODO — Home Experience - Fase 01.md`.
  - Futuros (no en este delta): `public/experience-drink.{avif,webp,png}` + `-2x` cuando exista el asset (T4.2).
  - Solo lectura: `docs/design/experience-intro/*` (no modificar).
  - Intocables: `tokens.css`, `typography.css`, `global.css`, `package.json`, `pnpm-lock.yaml`, `astro.config.ts`, `playwright.config.ts`, `index.astro`, `home-experience.spec.ts`, `smoke.spec.ts`, core (`SeoHead`, `BaseLayout`, `SkipLink`), `public/*` (hasta el swap del drink).
- **suggested_phases**: F0 inputs → F1 cielo/dock → F2 geometría → F3 motion/continuidad → F4 docs → F5 tests → F6 validación/QA/cierre (cada fase compila por sí sola y es verificable).

## 17. Marcadores

- `implementation_decisions_count`: 24 (D1–D24).
- `testing_decisions_count`: 14 (archivo nuevo, contextos mobile, stubs de permiso por estado + F1, spy de llamadas, gesto de retry y auto-remoción de listeners, sensores sintéticos, orientación simulada, helper de geometría, conteo de listeners, prueba de paridad de chispas, **muestreo de píxel 1×1 de continuidad**, **geometría del landing/dock**, sin snapshots, polling).
- `slices_defined`: 26 tareas atómicas (T0.1 y T0.2 resueltas; T1.1–T1.5, T2.1, T3.1–T3.7, T4.1–T4.2, T5.1–T5.6, T6.1–T6.3); todas desbloqueadas (T4.2 es spec-only sin asset).

## 18. Result Contract

- **status**: `pass` — spec reconciliado end-to-end con design v6 (sobre v5/v4); sin bloqueantes.
- **summary**: spec v4 + deltas v5/v6 incorporados: pipeline de permiso automático (F1/F2), label de denegación, amplitudes de estrellas v5, **continuidad intro→film v6** (film backdrop = stack del velo, opacidad constante 1, sin scale de panel, overlay gateado a video con metadatos, C1/C2), **aterrizaje del reloj v6** (dock 106×300/54×150, tween function-based a `scale 0.32/0.30` sin opacity/filter, reloj visible al 100 %, C3/C4), **contrato del drink** spec-only (C7/§7.10), supersesión de §22/§53 y referencia §56, criterios G/S/F2/E/C, tareas y validación actualizadas. Se mantienen los valores autoritativos de los cuatro artefactos (hashes verificados), la materialización de polvo/chispas (copias byte-identical + paridad) y las invariantes (2 timelines, transform/opacity, sin deps, CSP, sin “moon”).
- **artifacts**: este documento (deltas v5+v6); `docs/design/experience-intro/*` sin modificar; no se tocó código.
- **next_recommended**: `developer` aplica los deltas sobre el trabajo en curso y ejecuta F1–F6 → `reviewer` sobre el diff.
- **risks**: sensores iOS dependen de HTTPS; signos de landscape en QA; posible reordenamiento acotado de eventos de retry en iPhone; flakiness del muestreo de píxeles de continuidad (C1 por computed styles es la aserción primaria); divergencia del polvo reconstruido si aparece `check-mock.mjs` (decorativo; las chispas no tienen esta exposición gracias al JSON autoritativo + paridad); el drink sigue sin asset (dock vacío por diseño).
- **skill_resolution**: `writing-plans` sigue denegado por el tool `skill` en esta sesión; se mantiene el formato del plan de Fase 01 del repo como checklist. No se usaron otras skills (trabajo de especificación sin implementación).
