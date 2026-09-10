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

import { getScrollTrigger, prefersReducedMotion } from './gsap';
import { createSmoothScroll, type SmoothScrollHandle } from './lenis';

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

    // Critical nodes: without them the scene cannot be orchestrated — leave
    // the already-visible static layout untouched.
    if (!title || !veil || !clock || titleLines.length === 0) return;

    const filmSection = document.querySelector<HTMLElement>('[data-scroll-film]');
    const filmViewport = filmSection?.querySelector<HTMLElement>('.scroll-film__viewport') ?? null;
    const video = document.querySelector<HTMLVideoElement>('[data-scroll-film-video]') ?? null;

    // §19 — entry on load (JS confirmed, so gsap.set is allowed here, §44).
    // Slow, heavy, elegant; power3.out; no bounce/elastic/back. All initial
    // hidden states happen together, before any tween or ScrollTrigger (D3):
    // the film frame starts hidden only because JS is confirmed.
    gsap.set(titleLines, { opacity: 0, y: 24 });
    gsap.set(clock, { opacity: 0, scale: 0.94, y: 30 });
    if (filmViewport) {
      gsap.set(filmViewport, { opacity: 0, scale: 1.04 });
    }
    hiddenNodes = filmViewport ? [...titleLines, clock, filmViewport] : [...titleLines, clock];

    const entry = gsap.timeline({ defaults: { ease: 'power3.out' } });
    entry
      .to(titleLines, { opacity: 1, y: 0, duration: 1.05, stagger: 0.12 }, 0)
      .to(clock, { opacity: 1, scale: 1, y: 0, duration: 1.1 }, 0.15);
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

    // §22 — IntroTimeline. Positions are expressed on a 0–100 scale so each
    // tween maps directly to a §22 phase (1 unit = 1% of the scrub).
    let preloadUpgraded = false;
    const introTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: introSection,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
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

    // 15–40% — the title retires; lines leave with a slight stagger (§22).
    introTl
      .to(
        titleLines[0],
        { opacity: 0, y: -40, letterSpacing: '0.06em', duration: 25, immediateRender: false },
        15,
      )
      .to(
        titleLines[1],
        { opacity: 0, y: -40, letterSpacing: '0.06em', duration: 25, immediateRender: false },
        17.5,
      );

    // 20–55% — the clock transforms: scale, lift, barely-there rotation.
    introTl.to(
      clock,
      { scale: 0.72, yPercent: -8, rotation: 3, duration: 35, immediateRender: false },
      20,
    );

    // 35–65% — the next room surfaces behind (§23): film frame in, veil out.
    if (filmViewport) {
      introTl.to(filmViewport, { opacity: 1, scale: 1, duration: 30, immediateRender: false }, 35);
    }
    introTl.to(veil, { opacity: 0, duration: 30 }, 35);

    // §52 — the hint retires early, at the start of the run.
    if (hint) {
      introTl.to(hint, { opacity: 0, duration: 8 }, 0);
    }

    // 55–85% — the clock dissolves: shrink + fade + at most a 2px blur (§22).
    introTl.to(clock, { scale: 0.28, opacity: 0, filter: 'blur(2px)', duration: 30 }, 55);

    // 85–100% — settle: nothing animates; the film frame fills the screen.
    disposers.push(() => {
      introTl.scrollTrigger?.kill();
      introTl.kill();
    });

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
