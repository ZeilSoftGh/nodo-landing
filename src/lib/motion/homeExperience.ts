/**
 * Home experience orchestrator (§37) — Fase 01.
 *
 * Owns exactly two scroll-scrubbed timelines (§61/D1):
 * - IntroTimeline: the §22 phases of the intro scene.
 * - FilmTimeline: video.currentTime driven by scroll (§28/§30).
 * The load entry is a plain gsap timeline WITHOUT ScrollTrigger (§19/§61).
 *
 * Why `disposed` is checked after every await: cleanup can run while async
 * imports or the video `loadedmetadata` event are still pending; each
 * continuation re-checks the flag so nothing ever attaches after teardown.
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
    // §43 — degraded but complete experience: visible hero, static film
    // fallback, native scroll, no scrub, no currentTime writes.
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
    // timelines alone would leave title/clock/film frozen invisible.
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

    const filmSection = document.querySelector<HTMLElement>('[data-scroll-film]');
    const video = document.querySelector<HTMLVideoElement>('[data-scroll-film-video]') ?? null;

    // §19 — entry on load (JS confirmed, so gsap.set is allowed here, §44).
    // Slow, heavy, elegant; power3.out; no bounce/elastic/back. All initial
    // hidden states happen together, before any tween or ScrollTrigger (D3).
    // v6 continuity: the film viewport is NOT hidden anymore (constant
    // opacity 1 behind the veil) and has no panel scale tween.
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

    // §13.2 v6 — landing dock measurement. Function-based values plus the
    // timeline's `invalidateOnRefresh` recompute them on resize; the visible
    // bbox centre sits `0.00687 × offsetWidth` above the element centre
    // (clock-bbox.json fractions).
    const LANDED_SCALE = window.matchMedia('(max-width: 800px)').matches ? 0.3 : 0.32;
    const dockCenter = () => {
      const rect = dock?.getBoundingClientRect();
      return rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: 0, y: 0 };
    };

    // §22 — IntroTimeline. Positions are expressed on a 0–100 scale so each
    // tween maps directly to a §22 phase (1 unit = 1% of the scrub).
    let preloadUpgraded = false;
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
          // §35 — one-shot preload upgrade hint while the reveal approaches.
          // Best-effort only: the fallback never depends on this (R4).
          if (self.progress > 0.35 && !preloadUpgraded && video) {
            preloadUpgraded = true;
            video.preload = 'auto';
          }
        },
      },
    });

    // 0–15% — stable scene, minimal drift so the frame resists the scroll.
    introTl
      .to(clock, { y: () => -window.innerHeight * 0.005, duration: 15, immediateRender: false }, 0)
      .to(title, { y: () => -window.innerHeight * 0.01, duration: 15, immediateRender: false }, 0);

    // 15–40% — the title parts laterally (v4, DESIGN_SPEC §2): both lines leave
    // in opposite directions, no fade, no stagger, no vertical drift. ±120
    // clears the inline padding at every preset (§7.3.4).
    introTl
      .to(titleLines[0], { xPercent: -120, duration: 25, immediateRender: false }, 15)
      .to(titleLines[1], { xPercent: 120, duration: 25, immediateRender: false }, 15);

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

    // 20–55% — the clock transforms: scale, lift, barely-there rotation.
    introTl.to(
      clock,
      { scale: 0.72, yPercent: -8, rotation: 3, duration: 35, immediateRender: false },
      20,
    );

    // 35–65% — the next room surfaces behind (§23). v6 continuity: the film
    // viewport stays at opacity 1 with the exact veil stack behind the veil;
    // only the veil fades (no panel tween, no double-fade dip).
    introTl.to(veil, { opacity: 0, duration: 30 }, 35);

    // §52 — the hint retires early, at the start of the run.
    if (hint) {
      introTl.to(hint, { opacity: 0, duration: 8 }, 0);
    }

    // 55–85% — the clock lands on the dock (v6, DESIGN_SPEC §13.2) instead of
    // dissolving: function-based x/y to the dock centre, scale 0.32/0.30,
    // rotation back to 0, no opacity and no filter — the clock stays visible
    // and sharp at 100 %. Still one tween inside the introTl (C5).
    introTl.to(
      clock,
      {
        x: () => {
          const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
          return dockCenter().x - viewportWidth / 2;
        },
        y: () => {
          const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
          return dockCenter().y - viewportHeight / 2 + 0.00687 * clock.offsetWidth * LANDED_SCALE;
        },
        yPercent: 0,
        scale: LANDED_SCALE,
        rotation: 0,
        duration: 30, // 55 -> 85 %
        immediateRender: false,
        ease: 'none',
      },
      55,
    );

    // 85–100% — settle: nothing animates; the film frame fills the screen.
    // Every position above is expressed on the documented 0–100 §22 scale
    // ("1 unit = 1% of the scrub"): the last real tween ends at 85, so this
    // property-less spacer keeps the 85–100% settle window and normalizes the
    // timeline duration to 100. Without it the whole choreography (and the v4
    // acceptance values: sky fully out at 65, title exit cleared at 40) would
    // run ~17.6% later in scroll terms.
    introTl.to({}, { duration: 15 }, 85);
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

    // §28/§30 — FilmTimeline. video.duration is NaN until loadedmetadata
    // (R4), so the scrub controller is created only after that event —
    // or immediately if metadata is already available.
    let videoOk = true;
    let filmTween: gsap.core.Tween | null = null;
    const scrubState = { time: 0 };

    const createFilmScrub = () => {
      if (disposed || !filmSection || !video || !videoOk || filmTween) return;
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      // §7.9 v6 — a real video with loaded metadata is the only trigger for
      // the overlay (opacity 0 -> 1, 0.4 s ease); without material the
      // fallback keeps the veil stack and the attribute never appears.
      filmSection.dataset.videoReady = '';
      scrubState.time = 0;
      filmTween = gsap.to(scrubState, {
        time: duration,
        ease: 'none',
        scrollTrigger: {
          trigger: filmSection,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          onUpdate: () => {
            // Guarded write: never touch currentTime without ready frames
            // (R1/R4); the tween keeps tracking scroll if the video errors.
            if (!video || !videoOk || video.readyState < 1) return;
            if (Math.abs(video.currentTime - scrubState.time) > 0.01) {
              video.currentTime = scrubState.time;
            }
          },
        },
      });
      disposers.push(() => {
        filmTween?.scrollTrigger?.kill();
        filmTween?.kill();
        filmTween = null;
      });
    };

    const onVideoError = () => {
      // §26/§57 — the material is simply not there yet: keep the NODO
      // fallback, never write currentTime, no visual error. Dev-only note.
      videoOk = false;
      if (import.meta.env.DEV) {
        console.info('[NODO] ScrollFilm: video material not available yet — fallback stays.');
      }
    };

    if (video) {
      if (video.readyState >= 1) {
        createFilmScrub();
      } else {
        video.addEventListener('loadedmetadata', createFilmScrub);
      }
      video.addEventListener('error', onVideoError);
      disposers.push(() => {
        video.removeEventListener('loadedmetadata', createFilmScrub);
        video.removeEventListener('error', onVideoError);
      });
    }
  }

  return cleanup;
}
