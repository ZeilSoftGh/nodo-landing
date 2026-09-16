/**
 * Home experience orchestrator (§37) — Fase 01.
 *
 * Owns exactly two scroll-scrubbed timelines (§61/D1):
 * - IntroTimeline: the §22 phases of the intro scene (Scene 00).
 * - DrinkTimeline: the §28/§29 clock→drink choreography (Scene 01).
 * The load entry is a plain gsap timeline WITHOUT ScrollTrigger (§19/§61).
 *
 * The video logic is gone from this iteration (§37): `ScrollFilm.astro` is
 * preserved in the repo but NOT mounted, so `initHomeExperience()` never
 * queries `[data-scroll-film]`.
 *
 * Why `disposed` is checked after every await: cleanup can run while async
 * imports or the §45 asset predecodes are still pending; each continuation
 * re-checks the flag so nothing ever attaches after teardown.
 *
 * Resize/refresh: no manual listeners — Lenis `autoResize` (default true) and
 * ScrollTrigger's automatic refresh cover viewport changes (§37).
 *
 * Reduced motion: the init bails before any gsap.set (§43/D8) — the page stays
 * in its natural, fully visible state with native scroll.
 */

import { gsap } from 'gsap';

import { createDeviceTilt, type DeviceTiltHandle } from './deviceTilt';
import { getScrollTrigger, prefersReducedMotion } from './gsap';
import { createSmoothScroll, type SmoothScrollHandle } from './lenis';
import { createPointerParallax, type PointerParallaxHandle } from './pointerParallax';

export function initHomeExperience(): () => void {
  if (prefersReducedMotion()) {
    // §43 — degraded but complete experience: visible hero, static drink
    // final, native scroll, no scrub, no currentTime-like writes.
    return () => {};
  }

  const disposers: Array<() => void> = [];
  let disposed = false;
  // Nodes hidden by the entry gsap.set (D3), tracked so an init failure can
  // restore the CSS-defined static layout (§57).
  let hiddenNodes: HTMLElement[] = [];
  // Tilt controllers (pointer/gyro), armed on the entry completion / F2 hook.
  let tiltHandle: DeviceTiltHandle | null = null;
  let pointerHandle: PointerParallaxHandle | null = null;

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    for (const dispose of [...disposers].reverse()) {
      dispose();
    }
    disposers.length = 0;
  };

  void boot().catch(() => {
    // The experience must never take the page down with it (§57): an
    // unexpected init failure leaves the static fallback layout intact.
    // Revert the entry hidden states before tearing down — killing the
    // timelines alone would leave title/clock/drink frozen invisible.
    if (hiddenNodes.length > 0) {
      gsap.set(hiddenNodes, { clearProps: 'all' });
      hiddenNodes = [];
    }
    cleanup();
  });

  async function boot(): Promise<void> {
    // Query by data-attributes (§16/§24), never by Astro scoped classes.
    const introSection = document.querySelector<HTMLElement>('[data-experience-intro]');
    if (!introSection) return;

    const title = introSection.querySelector<HTMLElement>('.experience-intro__title');
    const titleLines = title
      ? Array.from(title.querySelectorAll<HTMLElement>('.experience-intro__line'))
      : [];
    const veil = introSection.querySelector<HTMLElement>('.experience-intro__veil');
    const hint = introSection.querySelector<HTMLElement>('.experience-intro__hint');
    const clock = introSection.querySelector<HTMLElement>('[data-experience-clock]');
    // v4 sky (decorative, optional), v6 dock and the v5 denied label.
    const sky = introSection.querySelector<HTMLElement>('[data-experience-sky]');
    const dust = introSection.querySelector<HTMLElement>('[data-experience-sky-dust]');
    const sparks = introSection.querySelector<HTMLElement>('[data-experience-sky-sparks]');
    const clockImg = clock?.querySelector<HTMLElement>('img') ?? null;
    const dock = introSection.querySelector<HTMLElement>('[data-experience-dock]');
    const tiltLabel = introSection.querySelector<HTMLElement>('[data-experience-tilt]');

    // Critical nodes: without them the scene cannot be orchestrated — leave
    // the already-visible static layout untouched.
    if (!title || !veil || !clock || titleLines.length === 0) return;

    // §17/§31 — Scene 01 nodes (ClockDrinkScene). Absent sections are a no-op:
    // the intro still runs and the page keeps its static fallback.
    const drinkSection = document.querySelector<HTMLElement>('[data-clock-drink]');
    const handoffClock =
      drinkSection?.querySelector<HTMLElement>('[data-drink-handoff-clock]') ?? null;
    const handoffImg = handoffClock?.querySelector<HTMLElement>('img') ?? null;
    const drinkGlow = drinkSection?.querySelector<HTMLElement>('[data-drink-glow]') ?? null;
    const drinkBase = drinkSection?.querySelector<HTMLElement>('[data-drink-base]') ?? null;
    const drinkGarnish = drinkSection?.querySelector<HTMLElement>('[data-drink-garnish]') ?? null;
    const drinkFinal = drinkSection?.querySelector<HTMLElement>('[data-drink-final]') ?? null;

    // §19 — entry on load (JS confirmed, so gsap.set is allowed here, §44).
    // Slow, heavy, elegant; power3.out; no bounce/elastic/back. All initial
    // hidden states happen together, before any tween or ScrollTrigger (D3).
    gsap.set(titleLines, { opacity: 0, y: 24 });
    gsap.set(clock, { opacity: 0, scale: 0.94, y: 30 });
    hiddenNodes = [...titleLines, clock];

    const entry = gsap.timeline({ defaults: { ease: 'power3.out' } });
    entry
      .to(titleLines, { opacity: 1, y: 0, duration: 1.05, stagger: 0.12 }, 0)
      .to(clock, { opacity: 1, scale: 1, y: 0, duration: 1.1 }, 0.15);

    // §7.3.2 (D7) — the tilt starts only when the entry has completed AND the
    // permission path allows it (iOS granted or Android auto). `entryComplete`
    // covers the case where the module is created after the timeline finished.
    let entryComplete = false;
    entry.eventCallback('onComplete', () => {
      entryComplete = true;
      tiltHandle?.arm();
    });
    disposers.push(() => {
      entry.kill();
    });

    // §39 — one Lenis instance for the page. Returns null under reduced
    // motion (already excluded) or if the library fails to load. The official
    // ScrollTrigger wiring (lenis scroll → ScrollTrigger.update, gsap ticker →
    // lenis.raf, lagSmoothing(0)) lives inside createSmoothScroll.
    const smoothScroll: SmoothScrollHandle | null = await createSmoothScroll({ lerp: 0.1 });
    if (disposed) {
      smoothScroll?.destroy();
      return;
    }
    if (!smoothScroll) return;
    disposers.push(() => {
      smoothScroll.destroy();
    });

    // Ensures ScrollTrigger is imported/registered before timelines exist.
    await getScrollTrigger();
    if (disposed) return;

    // §14/§15/§16 (clock→drink plan) — handoff dock measurement. The dock is a
    // 1×1 point that marks the VISIBLE centre of reloj.png, not the element
    // centre. Function-based values plus `invalidateOnRefresh` recompute them
    // on resize/orientation.
    //
    // Perceptual centre of `reloj.png` (designer calibration, Wave 2):
    // visible bbox x 370→1300, y 7→910 on the 1672×941 canvas; the pivot is the
    // measured bbox centre (835.5, 459.0) — NOT the canvas centre (836, 470.5)
    // and NOT the spec's earlier 330–1407 / (868.5, 456.5). The dial centre
    // (826.1, 475.1) is the garnish-match reference (±6 px), not the pivot.
    const CLOCK_CANVAS_WIDTH = 1672;
    const CLOCK_CANVAS_HEIGHT = 941;
    /** Measured bbox centre (bbox x 370→1300, y 7→910) — the landing pivot. */
    const CLOCK_VISIBLE_CENTER = { x: 835.5, y: 459.0 };
    /** −0.000299 — the visible centre is a hair left of the canvas centre. */
    const CLOCK_PERCEPTUAL_DX_FRACTION =
      (CLOCK_VISIBLE_CENTER.x - CLOCK_CANVAS_WIDTH / 2) / CLOCK_CANVAS_WIDTH;
    /** −0.012221 — the visible centre is above the canvas centre. */
    const CLOCK_PERCEPTUAL_DY_FRACTION =
      (CLOCK_VISIBLE_CENTER.y - CLOCK_CANVAS_HEIGHT / 2) / CLOCK_CANVAS_HEIGHT;

    // §15 — landed scale (designer calibration, Wave 2): a single value per
    // breakpoint, replacing v6's 0.32/0.30. Approved ranges: desktop
    // 0.44–0.52, mobile 0.55–0.62; chosen so the clock's numeral ring ≈ the
    // garnish's ring (ring-clock 0.371 × width).
    const LANDED_SCALE_DESKTOP = 0.46;
    const LANDED_SCALE_MOBILE = 0.58;
    const landedScale = () =>
      window.matchMedia('(max-width: 800px)').matches ? LANDED_SCALE_MOBILE : LANDED_SCALE_DESKTOP;

    const dockCenter = () => {
      const rect = dock?.getBoundingClientRect();
      return rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: 0, y: 0 };
    };

    // §22 — IntroTimeline. Positions are expressed on a 0–100 scale so each
    // tween maps directly to a §22 phase (1 unit = 1% of the scrub).
    // F2/D20 — the scrub release is a state transition detected on the
    // progress crossing (0.003), not an effect of the next input event.
    let releasedByScrub = false;
    const introTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: introSection,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const shouldRelease = self.progress > 0.003;
          if (shouldRelease !== releasedByScrub) {
            releasedByScrub = shouldRelease;
            pointerHandle?.setReleased(shouldRelease);
            tiltHandle?.setReleased(shouldRelease);
          }
        },
      },
    });

    // 0–12 % — hold (§13): the frame resists the scroll with minimal drift.
    introTl
      .to(clock, { y: () => -window.innerHeight * 0.005, duration: 12, immediateRender: false }, 0)
      .to(title, { y: () => -window.innerHeight * 0.01, duration: 12, immediateRender: false }, 0);

    // 12–38 % — the title parts laterally (§11/§13): both lines leave in
    // opposite directions, no fade, no stagger, no vertical drift. ±120
    // clears the inline padding at every preset (§7.3.4).
    introTl
      .to(titleLines[0], { xPercent: -120, duration: 26, immediateRender: false }, 12)
      .to(titleLines[1], { xPercent: 120, duration: 26, immediateRender: false }, 12);

    // §7.3.3 — decorative sky drift inside the same timeline (no third
    // ScrollTrigger). Disjoint properties: dust/sparks get yPercent/scale here
    // while the input modules own x/y/rotation.
    if (dust) {
      introTl.to(dust, { yPercent: -3, duration: 65, immediateRender: false }, 0);
      introTl.to(dust, { scale: 1.025, duration: 85, immediateRender: false }, 0);
    }
    if (sparks) {
      introTl.to(sparks, { yPercent: -7, duration: 70, immediateRender: false }, 0);
    }
    if (sky) {
      introTl.to(sky, { opacity: 0, duration: 30, immediateRender: false }, 35);
    }
    // D15 — the denied label retires with the hint (0–8%).
    if (tiltLabel) {
      introTl.to(tiltLabel, { opacity: 0, duration: 8 }, 0);
    }

    // 20–52 % — the clock starts its journey (§13): scale ~0.70, rotation
    // 2.5deg, minimal lift. No opacity, no filter — the clock never dissolves.
    introTl.to(
      clock,
      { scale: 0.7, yPercent: -8, rotation: 2.5, duration: 32, immediateRender: false },
      20,
    );

    // §52 — the hint retires early, at the start of the run.
    if (hint) {
      introTl.to(hint, { opacity: 0, duration: 8 }, 0);
    }

    // §24/§9 — handoff crossfade, Scene 00 side. The scenes overlap by 104svh
    // (`.clock-drink { margin-top: -104svh }`), so the drink viewport is pinned
    // at the exact same screen position, covering the viewport, 4svh before the
    // intro stops being pinned. The last 3 units fade the intro clock out
    // (opacity only, no blur) and the veil with it, so the identical stack of
    // the scene below becomes the visible frame with no background step (§25).
    // The handoff clock fades in over the first 3 % of the drink scrub: the two
    // fades overlap, keep the object co-located and never show two clocks.
    introTl.to(clock, { opacity: 0, duration: 3, immediateRender: false }, 97);
    introTl.to(veil, { opacity: 0, duration: 3, immediateRender: false }, 97);

    // 42–78 % — the clock travels to the handoff dock (§13/§14/§16): function-
    // based x/y for the *visible* centre, landed scale, rotation back to 0, no
    // opacity and no filter — the clock ends sharp and fully visible at 100 %.
    // Still one tween inside the introTl; the phase windows are the §13 ones.
    introTl.to(
      clock,
      {
        x: () => {
          const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
          return (
            dockCenter().x -
            viewportWidth / 2 -
            CLOCK_PERCEPTUAL_DX_FRACTION * clock.offsetWidth * landedScale()
          );
        },
        y: () => {
          const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
          return (
            dockCenter().y -
            viewportHeight / 2 -
            CLOCK_PERCEPTUAL_DY_FRACTION * clock.offsetHeight * landedScale()
          );
        },
        yPercent: 0,
        scale: () => landedScale(),
        rotation: 0,
        duration: 36, // 42 -> 78 %
        immediateRender: false,
        ease: 'none',
      },
      42,
    );

    // 78–100 % — hold (§13): nothing animates; the docked clock and the
    // background stay put. The property-less spacer keeps the documented
    // 78–100 window and normalizes the timeline duration to 100 (1 unit = 1 %).
    introTl.to({}, { duration: 22 }, 78);
    disposers.push(() => {
      introTl.scrollTrigger?.kill();
      introTl.kill();
    });

    // §7.3.1/§7.3.2 — input modules (desktop pointer / mobile gyro), created
    // once with their own cleanup. The F2 release is driven from the timeline's
    // `onUpdate` above; the gyro module additionally waits for `arm()` on the
    // entry completion (and, when created later, for the grant state).
    if (clockImg && sparks && dust) {
      pointerHandle = createPointerParallax({ clockImg, sparks, dust });
      if (pointerHandle) {
        const handle = pointerHandle;
        if (releasedByScrub) handle.setReleased(true);
        disposers.push(() => handle.destroy());
      }

      tiltHandle = createDeviceTilt(
        { clockImg, sparks, dust },
        tiltLabel ? { root: tiltLabel } : null,
      );
      if (tiltHandle) {
        const handle = tiltHandle;
        if (releasedByScrub) handle.setReleased(true);
        disposers.push(() => handle.destroy());
        if (entryComplete) handle.arm();
      }
    }

    // ── Scene 01 · DrinkTimeline (§28/§29/§37) ───────────────────────────────
    // The natural state (no JS / reduced motion) is the baked final (§36); here
    // the morph layers are prepared and the timeline scrubs the §29 phases.
    if (drinkSection && handoffClock && handoffImg && drinkBase && drinkGarnish && drinkFinal) {
      // §24 — the handoff clock starts hidden and fades in during the first
      // units of the drink scrub (the Scene 00 clock fades out at the end of
      // the intro scrub, co-located and co-timed).
      gsap.set(handoffClock, { opacity: 0 });
      gsap.set(drinkBase, { opacity: 0 });
      gsap.set(drinkGarnish, { opacity: 0, scale: 0.96 });
      gsap.set(drinkFinal, { opacity: 0, scale: 1.015 });
      if (drinkGlow) gsap.set(drinkGlow, { opacity: 0 });
      hiddenNodes.push(
        handoffClock,
        drinkBase,
        drinkGarnish,
        drinkFinal,
        ...(drinkGlow ? [drinkGlow] : []),
      );

      // §23 — dial reference points: reloj.png dial (826.1, 475.1) on the
      // 1672×941 canvas vs the garnish dial (54.4 %/49.4 % of the 1254×1254
      // master, placed by CSS at x 71.0 %/y 34.4 % of the product box). Their
      // difference is the small §29 lock correction (±20 px clamp).
      const CLOCK_DIAL_FX = 826.1 / 1672;
      const CLOCK_DIAL_FY = 475.1 / 941;
      const GARNISH_DIAL_FX = 0.544;
      const GARNISH_DIAL_FY = 0.494;
      // The correction is applied to the inner <img>, inside the wrapper's
      // `scale(--handoff-scale)`: convert viewport px to the local px space.
      const handoffScale = () =>
        Number.parseFloat(getComputedStyle(handoffClock).getPropertyValue('--handoff-scale')) || 1;
      const dialDelta = () => {
        const clockBox = handoffClock.getBoundingClientRect();
        const garnishBox = drinkGarnish.getBoundingClientRect();
        return {
          x: gsap.utils.clamp(
            -20,
            20,
            garnishBox.left +
              garnishBox.width * GARNISH_DIAL_FX -
              (clockBox.left + clockBox.width * CLOCK_DIAL_FX),
          ),
          y: gsap.utils.clamp(
            -20,
            20,
            garnishBox.top +
              garnishBox.height * GARNISH_DIAL_FY -
              (clockBox.top + clockBox.height * CLOCK_DIAL_FY),
          ),
        };
      };

      const drinkTl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: drinkSection,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          invalidateOnRefresh: true,
        },
      });

      // 0–4 % — HANDOFF CROSSFADE (§24): the handoff clock fades in at the dock
      // while the Scene 00 clock fades out at the end of the intro scrub; both
      // are co-located because the scenes overlap. 4 units keep the two fades
      // overlapping on mobile too (its drink scrub is shorter). No trajectory,
      // no blur — opacity only.
      drinkTl.fromTo(
        handoffClock,
        { opacity: 0 },
        { opacity: 1, duration: 4, ease: 'power1.inOut', immediateRender: false },
        0,
      );

      // 4–10 % — MATCH HOLD: only the handoff clock while the user accepts the
      // object continuity. 8–36 % — REVEAL PRODUCT: the base rises from 5svh
      // behind the clock while the glow lights up.
      drinkTl.fromTo(
        drinkBase,
        { opacity: 0, scale: 0.96, y: () => window.innerHeight * 0.05 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 28,
          ease: 'power1.inOut',
          immediateRender: false,
        },
        8,
      );
      if (drinkGlow) {
        drinkTl.fromTo(
          drinkGlow,
          { opacity: 0 },
          { opacity: 0.35, duration: 28, ease: 'power1.inOut', immediateRender: false },
          8,
        );
      }

      // 24–48 % — LOCK TO GARNISH: finish the correction onto the garnish dial
      // with a small movement only (the big trajectory happened in Scene 00).
      drinkTl.to(
        handoffImg,
        {
          x: () => dialDelta().x / handoffScale(),
          y: () => dialDelta().y / handoffScale(),
          rotation: 2,
          duration: 24,
          ease: 'power1.inOut',
          immediateRender: false,
        },
        24,
      );

      // 42–58 % — CLOCK → GARNISH: the main crossfade, opacity only plus the
      // §29 silhouette scales (.94 / .96 → 1). No blur.
      drinkTl.to(
        handoffClock,
        { opacity: 0, duration: 16, ease: 'power1.inOut', immediateRender: false },
        42,
      );
      drinkTl.to(
        handoffImg,
        { scale: 0.94, duration: 16, ease: 'power1.inOut', immediateRender: false },
        42,
      );
      drinkTl.fromTo(
        drinkGarnish,
        { opacity: 0, scale: 0.96 },
        { opacity: 1, scale: 1, duration: 16, ease: 'power1.inOut', immediateRender: false },
        42,
      );

      // 58–72 % — COMPOSITE HOLD: base + garnish, nothing animates.

      // 72–84 % — BAKE TO FINAL: short crossfade (base and final share the
      // exact same box, §20).
      drinkTl.to(
        [drinkBase, drinkGarnish],
        { opacity: 0, duration: 12, ease: 'power1.inOut', immediateRender: false },
        72,
      );
      drinkTl.to(
        drinkFinal,
        { opacity: 1, duration: 12, ease: 'power1.inOut', immediateRender: false },
        72,
      );

      // 84–100 % — FINAL HOLD: only the baked product, breathing very slightly.
      drinkTl.to(
        drinkFinal,
        { scale: 1, duration: 16, ease: 'power1.inOut', immediateRender: false },
        84,
      );

      disposers.push(() => {
        drinkTl.scrollTrigger?.kill();
        drinkTl.kill();
      });

      // §45 — predecode the cocktail assets with guards: the DrinkTimeline is
      // already scrub-driven, so a decode never blocks the page; on failure
      // the baked final stays as the scene.
      const drinkImages = [drinkBase, drinkGarnish, drinkFinal] as HTMLImageElement[];
      void Promise.allSettled(drinkImages.map((image) => image.decode())).then((results) => {
        if (disposed) return;
        if (results.some((result) => result.status === 'rejected')) {
          drinkTl.scrollTrigger?.kill();
          drinkTl.kill();
          // §45/OBS-3 — clearProps also on the glow so its natural 0.35 is
          // restored with the rest of the fallback state.
          for (const node of [handoffClock, drinkBase, drinkGarnish, drinkFinal, drinkGlow]) {
            if (node) gsap.set(node, { clearProps: 'all' });
          }
        }
      });
    }
  }

  return cleanup;
}
