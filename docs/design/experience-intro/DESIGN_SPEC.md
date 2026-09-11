# NODO · Fase 01 — ExperienceIntro “sky” + tilt layer · Design spec v6

- **Status**: revision v6 — seamless intro→film continuity, clock landing at a dock anchor (future drink), drink asset spec. v5 (auto-permission, denied label, star motion, F1/F2) and v4 (text exit) are unchanged.
- **v6 adds**: film fallback background identical to the veil + overlay gated off + film at constant opacity 1 + no reveal scale; the 55–85 % dissolve replaced by a function-based landing of the clock wrapper to `[data-experience-dock]` (no blur, clock visible to 100 %); the drink asset contract (§13).
- **Scope**: `src/components/home/ExperienceIntro.astro` + `src/lib/motion/homeExperience.ts` + `src/components/home/ScrollFilm.astro`. No `src/**` or test files were modified by this handoff.
- **Review artifact**: `mock/index.html` (5 presets; state/pointer/permission/stars/continuity/dock/exit controls; live clearance badges) → `mock/stage.html` (`__stage` API), `shots/`, `clock-bbox.json`, `gyro.json`, `particles.json`, `sparks.json`.

## Sources of truth

| Source | Role |
|---|---|
| `docs/NODO — Home Experience - Fase 01.md` (§11–§23, §40–§47, §54, §58, §60–§62) | product/visual truth |
| `docs/superpowers/specs/2026-09-09-nodo-fase-01-orchestration-design.md` (D1–D10, R1–R7) | approved technical decisions |
| `docs/ai/plans/2026-09-09-nodo-fase-01-plan.md` (N1–N5) | implementation contract (CSP, no inline styles, 2 timelines, naming) |
| MDN · [Window: deviceorientation event](https://developer.mozilla.org/en-US/docs/Web/API/Window/deviceorientation_event) | event semantics; **secure context only**; beta = front/back, gamma = left/right |
| MDN · [DeviceOrientationEvent.requestPermission()](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static) | iOS gate: **transient activation required**, returns `granted`/`denied`, rejects `NotAllowedError` without activation; `absolute: true` would also request the magnetometer |
| MDN · [Orientation and motion data explained](https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events/Orientation_and_motion_data_explained) | beta/gamma sign conventions; device frame is portrait-relative — use `ScreenOrientation` for compensation |
| `src/styles/tokens.css`, `src/styles/global.css`, `tests/e2e/home-experience.spec.ts` | tokens, grain, test-asserted selectors |

---

## 1. Gyro spec (device tilt on touch/coarse devices)

### 1.1 Permission UX (v5 — automatic, no controls)

The pipeline runs on load, only when `(pointer: coarse)` and width ≤ 800 px and motion is not reduced. There is **no button and no focusable element anywhere**.

| State | Condition / trigger | Movement | UI |
|---|---|---|---|
| `unsupported` | no `DeviceOrientationEvent` / no usable API | off | none |
| `auto` | events exist, `requestPermission` is not a function (Android Chrome/Firefox) | on after entry | none |
| `pending` | `requestPermission` exists; load attempt rejected (`NotAllowedError`, no gesture yet) | off | none (retry armed) |
| `prompt-unknown` | `requestPermission()` resolved anything that is **not** `granted`/`denied` (`'prompt'`, `'default'`, `undefined`, unknown string) | off | none (retry armed) |
| `requesting` | a call is in flight (load or gesture retry) | off | none |
| `granted` | resolved `'granted'` | arms on entry-complete (or immediately if already complete) | none |
| `denied` | **resolved `'denied'` only** | off | **label shown** (§1.1.1) |

- **Load attempt**: on init (after capability detection) call `requestPermission()` once. On iOS Safari this rejects `NotAllowedError` (no transient activation) → `pending`; on Chromium builds that now expose the API it may resolve `'prompt'`/unknown → `prompt-unknown`. **Never treat a non-final result as a denial** (F1) — no “Sin movimiento”, no label.
- **One-shot gesture retry**: from `pending`/`prompt-unknown`, arm a passive, self-removing listener on the first of `pointerdown`, `touchstart`, `wheel`, `scroll`, `keydown`; on fire, remove all five and call `requestPermission()` once (`requesting`). A second failure ends the pipeline silently for this page load (only a *resolved* denial shows the label).
- **After a real denial**: no retry in the same page load; the next page load runs the load attempt again (iOS does not re-show the native prompt by itself; a fresh load is the honest way to “ask again”, and it succeeds if the user changed Settings).
- **Decision memory**: module-scoped in `homeExperience.ts`, in-memory for the page load only; **no storage** (no localStorage/cookie/sessionStorage).
- **Android**: auto-start, no UI (unchanged).
- **Reduced motion**: never requested, never listens, label never shown.
- **Secure context**: `deviceorientation` and `requestPermission()` are secure-context-only (MDN) → HTTPS required (localhost exempt). **Deployment risk to flag.**

#### 1.1.1 Denied label spec

- **Semantics**: single non-interactive `<p class="experience-tilt" data-experience-tilt role="status" hidden>`; `pointer-events: none` (can never block a gesture or scroll); no button, no tab stop.
- **Copy (ES)**: title **“Viví la experiencia completa”** (uppercase via CSS, `.62rem`, tracking `.18em`, cream) + hint **“Habilitá el acceso a movimiento y orientación en Ajustes › Safari y volvé a entrar.”** (`.58rem`, stone 80 %). The Settings hint is deliberate: iOS will not re-show the native prompt by itself, so the honest recovery path is Settings + reload — the label must not imply a tap-to-fix.
- **Placement/visibility**: centered above the “Scroll ↓” hint, same anchor as before (`bottom: calc(clamp(1.5rem,4svh,3rem) + 1.75rem)`); revealed only when state = `denied` and (entry complete, or immediately if the denial resolves later), never under reduced motion, never on desktop (the pipeline never runs there). Retires with the hint (opacity → 0 in the existing 0–8 % tween).
- **Retired**: the v3 ask button, its `role="status"` confirmation and the privacy line. The OS dialog is now the only consent surface; a privacy line without an ask would be noise. (Flagged as an intentional removal.)
- **Gotcha (kept from v3)**: never put `display` on the base `.experience-tilt` rule — scope layout styles with `:not([hidden])`, or the label would show without JS.

### 1.2 Sensor mapping

- **Event**: `deviceorientation` only. `deviceorientationabsolute` / `webkitCompassHeading` are **not** used — only relative tilt is needed, and asking for absolute would request the magnetometer on iOS (`requestPermission(true)`).
- **Axes** (MDN): `beta` = front/back tip; 0 = flat, grows toward +180 as the top tips toward the user. `gamma` = left/right tilt; 0 = level, positive = right side down. `alpha` (compass twist) unused.
- **Baseline**: on start, average the first 8 valid samples (≤ 320 ms) → `beta0`, `gamma0`. Every later sample is a deviation from that held posture. Re-captured on resume (visibility/orientation/scroll-top return).
- **Mapping (portrait)**: `dx = gamma − gamma0` → **x** (positive = tilt right); `dy = beta − beta0` → **y** (positive = tip toward the user). Content follows the tilt like an object attached to the phone.
- **Normalization**: `n = clamp((|d| ≤ 1.5° ? 0 : d) / 25°, −1, 1)` — deadzone 1.5° (hand tremor), full scale ±25°.
- **Low-pass**: EMA α = 0.2 per event before the tween targets (≈ 80 ms time constant; sensor events ~60 Hz).
- **Tweening**: the *same* GSAP `quickTo` setters as the desktop pointer — clock 1 s / sparks 1 s / dust 1.5 s, `power2.out` — so gyro and pointer share one motion language and no rAF loop is added.
- **Screen-orientation compensation**: the device frame is portrait-relative (MDN), so rotate the tilt vector by `screen.orientation.angle` (fallback `window.orientation`, else 0):
  ```ts
  const a = ((screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI) / 180;
  const nx =  dx * Math.cos(a) + dy * Math.sin(a);
  const ny = -dx * Math.sin(a) + dy * Math.cos(a);
  ```
  Portrait (a = 0) is the tested identity; landscape is **outside the no-occlusion contract** and the rotation sign is `unverified` on real devices (one-line flip if QA shows inversion).

### 1.3 Amplitudes per depth (v5)

Clock (unchanged — occlusion budget): `x = n · min(24, 0.062 · vw)` px, `y = n · 14` px.
Stars (v5 increase, ≈ +60 % perceived): sparks **48 %** of the clock offset (rotation `n·0.45°`, was 30 %/0.30°); dust **36 %** (rotation `n·0.34°`, was 23 %/0.22°).

| Viewport | clock x / y | sparks x / y | dust x / y |
|---|---|---|---|
| 390×844 | ±24.0 / ±14.0 | **±11.5 / ±6.7** | **±8.6 / ±5.0** |
| 360×640 | ±22.3 / ±14.0 | **±10.7 / ±6.7** | **±8.0 / ±5.0** |

Desktop pointer (clock unchanged `/15`): sparks translate **`/32`** (was `/50`) → ±22.5 px at 1440 / ±30 at 1920, rotation **`/2000`** (was `/3000`) → ±0.36° at 1440; dust **`/40`** (was `/65`) → ±18.0 px at 1440 / ±24 at 1920, rotation **`/2600`** (was `/4000`) → ±0.28° at 1440.

Bounded and safe: the clock's own budget is untouched, so the clock↔title occlusion contract is unaffected. Stars are decorative layers behind everything; at these amplitudes (max ≈ 22.5 px desktop, ≈ 11.5 px mobile) and low opacity the marks stay inside the negative-space composition and do not impair title legibility. Depth order is preserved (clock : sparks : dust = 1 : 0.47 : 0.375 vs the v4 1 : 0.30 : 0.23).

### 1.4 Lifecycle

- **Start**: only after the entry timeline completes and only when granted (iOS) or auto (Android); one `deviceorientation` listener, `{ passive: true }`; baseline capture; never on fine-pointer/desktop.
- **Pause/resume**: `IntersectionObserver` on `[data-experience-intro]` — off-screen → release offsets to 0 and ignore samples; on-screen → resume + re-baseline. `visibilitychange` hidden → same pause; visible → resume + re-baseline.
- **Scrub release (F2)**: the release is invoked from the `introTl` ScrollTrigger `onUpdate` **on the progress crossing** — when `self.progress > 0.003` transitions, call every setter (pointer + gyro) to 0 and ignore further input until the threshold is crossed downward; re-arm below 0.003. It no longer waits for the next pointer/sensor event.
- **Reduced motion**: never starts.
- **Cleanup**: remove listener + observers + timer; zero the offsets.
- **Battery**: one passive listener at sensor rate feeding `quickTo` targets, no rAF loop, no canvas, no per-event layout; paused off-screen and when hidden.
- **Licence/privacy**: no third-party code or dependencies; the sensor stream is processed in-page and never transmitted.

## 2. Text exit (v4 — reference-style lateral split)

The title exit inside the existing `introTl` (no new timeline, no new ScrollTrigger):

- **Motion**: line 1 (`justify-self: start`, “Bienvenido a la”) parts **left** with `xPercent: -120`; line 2 (`justify-self: end`, “experiencia NODO”) parts **right** with `xPercent: +120`. Only `xPercent` — the previous `opacity: 0`, `y: -40` and `letterSpacing: '0.06em'` tweens are **replaced** (the reference parts without fading; a fade would read as a generic disappear, not a parting).
- **Why ±120, not the reference’s ±100**: the reference’s lines sit edge-to-edge; our lines are inset by `padding-inline` (up to 6 rem). At −100 the trailing edge would remain visible inside the padding band for the whole post-exit scene (worst inset ratio 14 % of the line width: 1440×900 padding 86 px vs line 1 width 619 px). ±120 clears with margin at every preset and both font stacks — measured: line 1 right edge −37.5 px (1440), −30 px (360); line 2 left edge viewport-width +59 px (1440), +39 px (360).
- **Both lines together, no stagger**: the reference splits both with one duration — the synchronized parting is the signature. A stagger would read as a sequence and weaken it. §22’s “don’t disappear all at once” is satisfied by the divergence itself (the lines leave in opposite directions).
- **Reference’s downward drift `y += visualViewport.height/2`: dropped.** Verification (stage variant `exitMode: 'drift'`): with the drift the line↔clock ink clearance goes negative on **all five presets** during the exit (1440×900: −60.6 px at t 0.25, −149.8 at 0.30; 390×844: −21.2 at 0.20; 360×640: −14.5 at 0.20). The reference’s title has no clock beneath it; ours does, and the no-occlusion contract outranks the drift. The mock’s “ref drift” toggle keeps the variant inspectable.
- **Placement in the scrub**: both lines start at **15** with `duration: 25` (complete at **40**, the end of §22’s title window). Easing `ease: 'none'` — the intro timeline’s scrub default (linear in scroll); the reference’s `.6 s /.2 s` are time-based inside its own timeline and translate to “one window, both lines”. **Portrait variant**: the `.2` ratio (≈3× faster) is intentionally not reproduced — the mobile section is already shorter (180 svh vs 220 svh ≈ 18 % less physical scroll for the same fraction) and a per-breakpoint duration would need `matchMedia`-conditional timeline construction (second code path, invalidation risk) for a marginal pacing difference; flagged as an open question.
- **Overflow**: `xPercent` is a transform — no layout change, no scroll-width growth; the sticky viewport’s `overflow: hidden` clips the lines. OverflowX verified 0 through the exit.
- **Reduced motion / no JS**: unchanged — the title stays fully visible and static (`init` bails before any transform).
- **Exact `introTl` change** — the two existing tweens are replaced 1:1 (same targets), one position moved from 17.5 to 15:

  ```ts
  // was: { opacity: 0, y: -40, letterSpacing: '0.06em' } @15 and @17.5
  introTl
    .to(titleLines[0], { xPercent: -120, duration: 25, immediateRender: false }, 15)
    .to(titleLines[1], { xPercent:  120, duration: 25, immediateRender: false }, 15);
  ```

## 3. No-occlusion contract (from v2, updated)

Measured clock visible bounds (α ≥ 16): **x 370→1300, y 7→910 px** (931 × 904) = **x 22.13→77.81 %, y 0.74→96.81 %** of the 1672×941 canvas. Criterion: the clock’s visible box must not intersect either line’s CSS line box (≥ 0 px) nor ink bounds (target ≥ 8 px), including pointer and gyro extremes.

**Changed in v3**: mobile `row-gap` `clamp(7.5rem, 30svh, 16rem)` → **`clamp(7.5rem, 34svh, 16rem)`** — the budget that keeps the contract with ±14 px tilt at 360×640. Desktop values unchanged from v2 (gap `clamp(12rem, 52svh, 34rem)`, clock `clamp(18rem, 40vw, 42rem)` / `calc(40svh * ratio)`; mobile clock `min(80vw, 24rem)` / `calc(32svh * ratio)`).

**Measured (webfont, minimum clearances line box / ink, px):**

| Viewport | worst top | worst bottom | with tilt? |
|---|---|---|---|
| 1440×900 | 45.2 / 84.2 | 51.3 / 38.2 | no (pointer only) |
| 1440×700 | 21.6 / 60.6 | 26.7 / 13.5 | no |
| 1280×650 | 19.4 / 54.4 | 25.5 / 14.8 | no |
| 390×844 | 28.0 / 45.0 | 31.3 / 24.3 | **yes**, ±1 both signs |
| 360×640 | 15.3 / 32.3 | 18.6 / 12.3 | **yes** |

Fallback font (Times New Roman forced): min line box 19.4 px / min ink 16.7 px → pass. Asset bbox drift 0 px; overflowX 0 on all five presets; 0 console/page errors. Full matrix: `check-mock.mjs`.

**v4 lateral exit**: pure `xPercent` leaves every vertical relation unchanged, and the measured margins through t 0.15→0.40 *grow* (desktop top ≥ 79.7 px, bottom ≥ 76.8 px; mobile worst ink 23.1 px at 360×640) because the only vertical motion in the window is the existing 0–15 % `−1vh` block drift. Trajectory assertions: at 20 % the lines carry −24 / +24 % and are on-screen; at 40 % line 1 right = −37.5 px and line 2 left = viewport + 59 px (1440) — fully cleared, ≥ 30 px margin at every preset. The reference drift variant fails on all five presets (§2) and is not shipped.

## 4. Markup contract (v2 sky + v3 tilt control)

- Sky layer unchanged: `.experience-sky` after `.experience-intro__veil`, before `<h1>`; no inline styles; dust = SVG presentation attributes generated with an Astro template map (not `set:html`); sparks = component classes; `aria-hidden`, `pointer-events: none`.
- New denied label per §1.1.1: SSR `hidden`, revealed only by JS; `role="status"`, `pointer-events: none`, no focusable element. **Implementation gotcha (kept from v3):** scope its layout styles with `.experience-tilt:not([hidden])` (never a bare `display` on the base rule) or the label would show without JS. Paint order stays veil < sky < title < clock < hint < label.
- Names: `experience-sky`, `experience-sky__dust`, `experience-sky__spark(s)`, `experience-tilt`, `experience-tilt__title/__hint`. The v3 names `experience-tilt__ask/__note/__status` are **removed**. The word “moon” does not appear anywhere.

## 5. Sky composition (unchanged)

150 dust circles desktop / 75 mobile (nth-of-type(2n) hidden); 78 % cream / 22 % stone; r 0.7–2.0 px; opacity 0.10–0.30; bottom mask `linear-gradient(0deg, transparent 0%, rgb(0 0 0/.5) 26%, #000 58%)`; 11 gold sparks desktop / 8 mobile (sizes 8–16 px, opacity 0.34–0.62, static radial halo, flat-SVG mask); twinkle only #1/#5/#7, 8 s alternate ×0.82, gated to `prefers-reduced-motion: no-preference`; sky fades 35–65 % with the veil. Seed `mulberry32(0x4E4F444F)`, coordinates in `particles.json`; **per-index spark table (positions, sizes, opacities, tones, twinkle, mobile hides/overrides) in `sparks.json`**.

## 6. Motion model

| Surface | Input | Mapping | Tween |
|---|---|---|---|
| Desktop fine pointer (>800) | `pointermove` | clock `(client−mid)/15`; sparks `/32` + rot `/2000`; dust `/40` + rot `/2600` (v5) | quickTo 1 s / 1 s / 1.5 s `power2.out` |
| Mobile coarse (≤800) | `deviceorientation` | §1.2/§1.3 (normalized tilt → the same three depths; stars 48 %/36 %) | same quickTo setters |
| Intro title (scrub, both layouts) | scroll | line 1 `xPercent −120` → left; line 2 `+120` → right; both start 15, duration 25 (done at 40) | `ease: 'none'` (scrub default) |
| Clock landing (scrub, both layouts) | scroll | 55–85 %: wrapper `x/y` function-based to the dock center, `yPercent → 0`, `scale 1→0.72→0.32` (desktop) / `0.30` (mobile), `rotation → 0`; visible at 100 % | `ease: 'none'` |

Both surfaces share the release-on-threshold rule (F2: invoked from `introTl` `onUpdate` on the progress crossing, not on the next input event), the pause rules, and are fully disabled under reduced motion. Scroll drift tweens (dust `yPercent −3` 0–65 % + `scale 1.025` 0–85 %; sparks `yPercent −7` 0–70 %; sky opacity 35–65 %) and the existing clock/title/veil/film tweens are unchanged; total scrub timelines remain **2**.

## 7. Responsive & performance

| | Desktop (>800 px) | Mobile (≤800 px) |
|---|---|---|
| Title row-gap | `clamp(12rem, 52svh, 34rem)` | `clamp(7.5rem, 34svh, 16rem)` |
| Clock | `clamp(18rem, 40vw, 42rem)` / `calc(40svh * ratio)` | `min(80vw, 24rem)` / `calc(32svh * ratio)` |
| Dust / sparks | 150 / 11 | 75 / 8 |
| Input | pointer | gyro (after permission) |
| Gyro budget | — | clock ±min(24, 6.2vw) / ±14 px |

New DOM: sky ≈ 176 nodes + denied label 2 nodes (`__title`, `__hint` spans inside one `<p>`), SSR `hidden`. Animated per frame: 2 sky layer transforms + clock transform + opacity tweens + ≤ 3 twinkle opacities — composited only; one rAF (GSAP ticker); no per-event layout.

## 8. Testability notes (for the specifier/developer)

- **Simulate permission per state** (Playwright `page.addInitScript`): `granted`/`denied` → `DeviceOrientationEvent.requestPermission = () => Promise.resolve('granted' | 'denied')`; non-final (F1) → `Promise.resolve('prompt')`; iOS load attempt without a gesture → `Promise.reject(new DOMException('', 'NotAllowedError'))`; Android → no `requestPermission` property; unsupported → `delete window.DeviceOrientationEvent`. Spy the calls (`window.__calls`) to assert counts.
- **Assert the automatic flow**: init calls `requestPermission` exactly once with no interaction; the first dispatched gesture (`pointerdown`) triggers exactly one more call and the listeners self-remove; a second failure never calls again in the page load.
- **Assert no interactive control**: `[data-experience-tilt]` contains no `<button>` and no element with `tabindex >= 0`; `getComputedStyle(...).pointerEvents === 'none'`.
- **Assert the label**: `role="status"`, `hidden` for every state except a resolved `denied`, exact copy, and never shown under reduced motion or on desktop (pipeline not started).
- **Simulate tilt** (Playwright, Chromium builds `DeviceOrientationEvent`):
  ```ts
  await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: 95, gamma: 12 })));
  ```
- **Simulate orientation**: `Object.defineProperty(screen.orientation, 'angle', { get: () => 90 })`.
- **Amplitude assertions (v5)**: pointer extreme at 1440 → sparks transform x ≈ 720/32 = 22.5 px, dust ≈ 720/40 = 18 px, rotations ≈ 0.36°/0.28°; gyro full tilt at 390 → sparks ≈ 0.48 × 24 = 11.52 px, dust ≈ 8.64 px (v4 values 14.4/11.08 and 7.2/5.52 are reachable only via the mock's comparison toggle).
- **F2 assertion**: with a pointer extreme applied and gyro at full tilt, set scrub progress to 0.01 **without dispatching any input** → clock img/sparks/dust transforms are exactly `translate(0px, 0px)`; return to 0 and dispatch the pointer again → offsets return.
- **Gate assertions**: coarse/≤800 only (desktop dispatch causes no transform); reduced motion → no listener, no inline transforms; off-screen (scroll past the intro) → offsets 0.
- **No-occlusion assertions** (extend the v2 set): at 390×844 and 360×640, with `setGyro(±1, ±1)` in all four sign combinations at t = 0, plus the existing scrub states, assert line box ≥ 0 and ink ≥ 8.

## 9. Acceptance criteria candidates

v2 criteria 1–9 (structure/no-JS/reduced-motion/twinkle/budgets/mask/overflow/2-timelines/pointer gating) and 10–13 (no-occlusion, asset bbox, fallback font, vertical fit) stay; v5 replaces the v3 G1–G4:

- **G1 — No interactive control**: no button, no focusable element, no `[data-experience-tilt-ask]` anywhere; the only tilt DOM is the non-interactive label (`pointer-events: none`).
- **G2 — Automatic load attempt**: init calls `requestPermission()` exactly once when the API exists, without user interaction; when the API is absent → `auto` (Android) and movement arms after entry.
- **G3 — Non-final results are retryable (F1)**: `'prompt'`, unknown strings, `undefined` and non-denial rejections never produce a denial state, never show the label, and arm the one-shot gesture retry.
- **G4 — Gesture retry**: the first of `pointerdown/touchstart/wheel/scroll/keydown` triggers exactly one additional `requestPermission()` call, listeners self-remove; `granted` arms movement, `denied` shows the label.
- **G5 — Denied label**: only a resolved `'denied'` shows the label; exact copy, `role="status"`, `pointer-events: none`, no focusable element, hidden under reduced motion and on desktop, fades with the hint.
- **G6 — Reduced motion**: `requestPermission` is never called, no listener is attached, no label is ever shown.
- **G7 — Movement arming**: sensors start only after a grant **and** after the entry timeline completes; a mid-intro grant arms on completion.
- **G8 — Tilt budget / no-occlusion**: at 390×844 and 360×640 full tilt yields line box ≥ 0 and ink ≥ 8 px; clock offsets equal ±min(24, 6.2vw)/±14 px; star offsets equal 48 %/36 % of the clock (v5).
- **G9 — Desktop unaffected**: on `(pointer: fine)` or width > 800 the pipeline never requests, never listens, no label, and a dispatched `deviceorientation` causes no transform.

v5 also adds:

- **S1 — Star amplitude (desktop)**: at 1440 pointer extreme → sparks `(w/2)/32` = 22.5 px and dust `(w/2)/40` = 18.0 px (±0.05), rotations `(w/2)/2000` = 0.36° and `(w/2)/2600` = 0.28°.
- **S2 — Star amplitude (mobile)**: at 390×844 gyro full tilt → sparks 0.48 × clock = 11.52 px, dust 0.36 × clock = 8.64 px (±0.05); at 360×640 → 10.71 / 8.04 px; the clock budget is unchanged.
- **F2 — Release on threshold**: crossing 0.003 releases pointer + gyro to 0 **with no further input events** (assert exact `translate(0px, 0px)`), re-arms below, and the offsets return on the next input.

v4 adds (text exit):

- **E1 — Direction**: at scrub 0.20 and 0.30, line 1 carries a negative `xPercent` and line 2 a positive one (line 1 left, line 2 right), and both are still partially on-screen.
- **E2 — Clears**: at scrub 0.40 both lines are fully outside the viewport with ≥ 8 px margin (line 1 right ≤ 0; line 2 left ≥ viewport width).
- **E3 — Pure translation**: no `opacity`/`letterSpacing` tween runs on the lines during 15–40 %; computed opacity stays 1 throughout.
- **E4 — No crossing during exit**: at every sampled t in 0.15–0.40 the lines’ CSS line boxes and ink never intersect the clock’s visible bbox (line box ≥ 0, ink ≥ 8 px) — criterion 10 applied to the new trajectory.
- **E5 — No overflow during exit**: `document.documentElement.scrollWidth − innerWidth` stays ≤ 0 at t 0.20/0.30/0.40 on all five presets (transforms must not grow scroll width).

## 10. Open questions (≤3, non-blocking; defaults chosen)

1. **Portrait exit pacing** — reproduce the reference’s `.2`/`.6` portrait ratio (≈3× faster split, e.g. a 9-unit window via `matchMedia`) or keep the single 25-unit window? *Default: single window; the mobile section is already ~18 % shorter in physical scroll.*
2. **Residual fade** — the reference parts without fading; add a very soft opacity tail (0.15–0.2 over the last 20 % of the exit) if the hard slide reads as abrupt on device? *Default: none (reference fidelity).*
3. **Tablets > 800 px** — desktop layout, no pointer and no gyro. *Default: exclude; revisit if tablet sessions matter.*

## 11. Open Design prompt (proposed, when a baseUrl is configured)

> skillId `motion-frames` · system `default` · kind `web-prototype`
>
> “NODO cocktail-bar intro. Desktop frames 1440×900/700, 1280×650; mobile frames 390×844, 360×640 (entry, title split at 20/30/40 %, landing 45 %, tilt extremes). Dark night-green #071311, petrol haze, gold jewelry; ornate gold/black steampunk clock centered between two editorial serif lines (cream #efe8d0, NODO italic gold-soft #e4c77a), ~52 svh gap desktop / 34 svh mobile. Behind the type: 150 cream/stone micro-dust + 11 gold compass-rose marks, bottom mask. Between 20 % and 40 % the two title lines part horizontally to the sides (line 1 left, line 2 right, ±120 %), pure translation, no fade. Mobile adds device-tilt parallax (roll→x, pitch→y; clock ±min(24,6.2vw)/±14 px; sparks 48 %, dust 36 %) requested automatically at load with a one-shot first-gesture retry (no controls); a non-interactive label ‘Viví la experiencia completa / Habilitá el acceso a movimiento y orientación en Ajustes › Safari’ if the user denied. No WebGL, no glassmorphism, no UI chrome.”

## 12. Evidence appendix (v5)

- **Check matrix** (`check-mock.mjs`): 5 presets × (13 desktop states | 16 mobile states) × 2 font modes; v4 exit trajectory + drift evidence; v5 auto-permission matrix (7 states), denied-label semantics, gesture retry (granted/denied), v5 star amplitudes (pointer + gyro), F2 pointer/gyro release, desktop no-op, reduced-motion → `RESULT: PASS — failures=0 warnings=0`, 0 console/page errors, bbox drift 0, overflowX 0.
- **Permission matrix readback**: `pending`/`requesting`/`prompt-unknown`/`unsupported` → applied (0,0), label hidden; `granted`/`auto` → (1,1), label hidden; `denied` → (0,0), label shown; label `role="status"`, title exact, hint contains “Ajustes”, `hasButton=false`; gesture retry → granted arms movement; retry → denied shows the label; reduced motion → no label, no gyro.
- **Star amplitude readback**: pointer at 1440 → v5 sparks 22.5 px / dust 18.0 px, rotations 0.36°/0.277° (v4 mode: 14.4/11.08); gyro at 390 → v5 sparks 11.52 px / dust 8.64 px, rotations 0.45°/0.34° (v4: 7.2/5.52); clock budget readback unchanged (±24/±14 at 390, ±22.32/±14 at 360).
- **F2 readback**: after crossing 0.003 with a pointer extreme + full gyro and **no further input**, clock/sparks/dust transforms read `translate(0px, 0px)`; after returning to 0 and re-dispatching the pointer, the offsets return.
- **Mock fidelity fix found in v5**: the v3/v4 mock computed star pointer offsets from the clock's offset (`current.x/50` ≈ dx/750) instead of `dx/50` — a 15× under-representation of the designed star motion; v5 corrects the mock math (`dx = current.x × 15`), so the comparison screenshots now show the true v4 vs v5 amplitudes.
- **Shots** (34): `shots/v5-<preset>-<state>.png` — desktop: init, init-br, init-br-v4 (comparison), exit030, exit040, landing045; mobile: pending (load attempt, no label), gesture-granted, denied-label, tilt-pp, tilt-pp-v4 (comparison), exit030, exit040; plus guides overlays and the review page.
- **Unverified**: real-device sensor signs/smoothing and iOS prompt timing; landscape compensation; portrait exit pacing feel on device; the real iOS retry behaviour after a Settings change (design assumes a fresh load can succeed); secure-context requirement in the real deployment (HTTPS).

---

## 13. v6 — Continuity, landing dock, drink asset

### 13.1 Continuity (intro → film)

The perceived shift came from three stacked differences, all removed:

| Source of shift | v5 | **v6** |
|---|---|---|
| Film fallback background | `radial green .44` + `gold .08` + `linear-gradient(#071311 → #0b201c 56% → #071311)` | **exact veil stack**: `radial-gradient(circle at 50% 46%, rgb(13 63 55 / .28), transparent 46%)`, `radial-gradient(circle at 86% 88%, rgb(201 167 67 / .06), transparent 30rem)`, flat `#071311` (no mid-band) |
| Film viewport opacity | tweened 0 → 1 over 35–65 % (both layers semi-transparent → body bleed, mid-fade dip) | **constant 1** (it sits behind the veil; only the veil fades 35–65 %) |
| Panel scale | `scale 1.04 → 1` over 35–65 % | **removed** (no transform on the panel; gradients no longer slide) |
| Overlay (`green .35` top / `night .6` bottom) | always on | **opacity 0 until a real video with loaded metadata exists**; flip to 1 (0.4 s ease) when the video guard fires |

- Timing unchanged: veil fade 35–65 %, §23 reveal mechanics preserved (flow overlap, film behind, no pin).
- Expected composite: veil opaque over the film at every progress point → the sampled background equals the veil stack at **every** scroll position. Verified in the mock at 1440×900/700, 1280×650, 390×844, 360×640: sampled pixel `(7,19,17)` at t 0.34/0.50/0.66 → **delta 0** (v5 mode: delta 2–3 at the same point; the visible mismatch at the panel centre was far larger).
- Mobile (≤800 px): identical (same stack, same timings); the veil/film are full-viewport in both layouts.
- **When the real video lands**: keep the film backdrop as-is behind the video (it doubles as the video's poster backdrop), keep the overlay gated to video-present, and retune the overlay only against real frames (documented future decision). No change to the §13.1 stack is required before then.

### 13.2 Landing dock

- **Node**: `<div class="experience-dock" data-experience-dock aria-hidden="true"></div>` inside `.experience-intro__viewport`, after the clock. `position: absolute; left: 50%; top: 74%; transform: translate(-50%, -50%)`, `pointer-events: none`, decorative (`aria-hidden`), zero visual in production (the mock renders a dashed placeholder for review only). No "moon"/"trago" naming.
- **Box** (the future drink frame): desktop `106 × 300 px`; mobile `54 × 150 px` (CSS custom props `--dock-w/--dock-h`). The future drink fills this box; the landed clock occupies ≈ 1/3 of its height (measured ratio 2.8–3.8 across breakpoints; ≈ 3:1 design intent, Mùn-like).
- **Geometry per breakpoint** (landed, measured): 1440×900 clock visible **99.7 px** high at `scale 0.32`; 1440×700 → 86.1; 1280×650 → 79.9; 390×844 → 50.6 at `scale 0.30`; 360×640 → 46.7. Visible centre offset from the element centre (`0.00687 × width × scale`, upward) is included in the tween targets.
- **Tween replacement** (inside `introTl`, §61 preserved — same position, one tween modified):

  ```ts
  // was: .to(clock, { scale: .28, opacity: 0, filter: 'blur(2px)', duration: 30 }, 55)
  introTl.to(clock, {
    x: () => dockCenter().x - visualViewport.width / 2,
    y: () => dockCenter().y - visualViewport.height / 2 + 0.00687 * clock.offsetWidth * LANDED_SCALE,
    yPercent: 0,
    scale: LANDED_SCALE,            // 0.32 desktop / 0.30 mobile (matchMedia or function values)
    rotation: 0,
    duration: 30,                   // 55 → 85 %
    immediateRender: false,
    ease: 'none',
  }, 55);
  ```

  `dockCenter()`/`clock.offsetWidth` are read inside the function-based values; `invalidateOnRefresh: true` (already on the timeline) recomputes them on resize. No Flip, no new deps (Flip remains a documented fallback only if the clock ever must change DOM parents). No `opacity`/`filter` tween: the clock stays **visible at 100 %**, sharp.
- **Interaction with pointer/gyro**: both own only the inner `<img>` and are already released during scrub (progress > 0.003), so the landed clock is static — the parallax stays a hero-at-rest behaviour. The wrapper is exclusively the scrub's.
- **No-occlusion during landing (55–100 %)**: the title lines are fully off-viewport at 40 % (`xPercent ±120`), so no intersection is possible; the check's `visible` flag (on-screen test) keeps 0.65/0.75 valid. Verified at 65/75/85/100 %: no intersection, `dx = dy = 0` at settle, opacity 1, no filter. The dock sits above the hint line (hint and label fade by 8 %).
- **Dock composition expectations from the future drink**: vertical glass centered in the box; bottom of the glass sits on the dock box bottom; the clock rests centered on the dock centre (behind/above the glass base); safe area = the box ±10 %; the drink's own shadow must be baked-free (CSS drop-shadow will match the clock's: `drop-shadow(0 2rem 4rem rgb(0 0 0/.42)) drop-shadow(0 0 3rem rgb(201 167 67/.08))`).

### 13.3 Drink asset spec (for choosing/cleaning the asset)

- **Master**: single **PNG-24 lossless, straight alpha, sRGB** (embedded IEC61966-2.1), no baked shadow/reflection, no matte (no white/black fringe), no watermark, no EXIF. Long side **≥ 960 px** (3× the largest CSS size), from a retouched source at 2–3×.
- **Production sets**: `<picture>` with **AVIF q60–70** + **WebP q85–92** + PNG fallback; `srcset` @1x/@2x.
- **Framing**: full glass cutout, centered, vertical; **6–8 % transparent margin** on all sides (shadow room); no crop of rim/foot; camera/light matching the clock (warm gold rim light for `#071311`).
- **Sizes** (derived from the dock box): desktop @1x **300 px** long side (106 px wide box → asset ≈ 300×~360–400 actual crop), @2x **600 px**; mobile @1x **150 px**, @2x **300 px**. Master long side 960 px covers both @2x sets with margin. Weight budgets: @1x AVIF ≤ 25 kB, WebP ≤ 45 kB, PNG ≤ 120 kB; @2x ≤ 2× those.
- **Loading**: `loading="lazy"` + `decoding="async"`, explicit `width`/`height` (aspect ratio), `fetchpriority="low"`, `aria-hidden="true"`, `alt=""`; never a candidate for LCP (the clock keeps `fetchpriority="high"`).
- **Naming**: `public/experience-drink.png` (+ `-2x`, `-1x` or hashed via the pipeline); placeholder name to be finalized with the chosen asset.
- **Delivery QA checklist**: alpha fringe test over `#071311` (no halos at 1×), no banding in gold gradients, sharpness at 2× (rim edges), no baked background/watermark, transparent margin 6–8 %, sRGB profile present, budgets met, visually matched colour temperature against `reloj.png`.

### 13.4 v6 acceptance criteria

- **C1 — Continuity (computed styles)**: film viewport background stack equals the veil stack (image + colour), film opacity is 1 (no tween), overlay opacity 0 while no video, film/panel transform none at all progress values.
- **C2 — Continuity (rendered)**: sampled background pixel at t 0.34/0.50/0.66 differs by ≤ 2 per channel on the five presets.
- **C3 — Landing geometry**: at t 0.85 and 1.0 the clock's visible bbox centre equals the dock centre (±2 px), `scale ≈ 0.32/0.30`, visible height = `0.5407 × elementWidth × scale` (±5 px), opacity 1, `filter: none`; the tween converges monotonically from 55 %.
- **C4 — Clock visible at 100 %**: no opacity/blur tween runs on the clock in 55–100 %; the clock remains visible at the end of the intro.
- **C5 — No new timelines/deps**: exactly two ScrollTriggers; the landing is one modified tween inside `introTl`; no Flip/GSAP plugins beyond the current set.
- **C6 — Docked decorative**: `[data-experience-dock]` is `aria-hidden="true"`, `pointer-events: none`, no focusable content, no document overflow at any landing state.
- **C7 — Asset spec compliance**: master/derivatives per §13.3 (format, sizes, weight budgets, transparency, QA checklist).

### 13.5 Supersession and impact notes

- **Product doc §22/§53 (“el reloj desaparece”)**: superseded by the user decision of v6 — the clock no longer dissolves; it lands at the dock and stays visible to 100 %. The §22 phase windows (20–55 transform, 55–85 landing) are preserved; only the 55–85 content changes.
- **E2E no-occlusion check**: remains valid (title off-screen during landing; on-screen flag gates the measurement). Keep sampling 0.65/0.75 and add 0.85/1.0 (dock assertions in the design harness; the production test can assert the dock end-state).
- **Future video**: when the real video lands, revisit the overlay gating (currently opacity 0 without video) and the film backdrop decision; the continuity stack stays the default.
- **Files for the next implementation**: `ExperienceIntro.astro` (dock node + its CSS), `homeExperience.ts` (landing tween replacing the dissolve + dock measurement), `ScrollFilm.astro` (film fallback background = veil, overlay default opacity 0 + `data-video-ready` gating, remove the scale tween). No other files.
