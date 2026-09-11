/**
 * Smooth-scroll abstraction for Lenis (§24).
 *
 * Constraints that MUST be respected when this factory is used for real:
 * - Nothing here initializes Lenis globally or alters native scroll by default.
 * - Integrates with GSAP ScrollTrigger using the official recipe: lenis scroll
 *   events call ScrollTrigger.update and gsap.ticker drives lenis.raf (§39) —
 *   a single requestAnimationFrame loop, owned by the gsap ticker.
 * - Anchor navigation must keep working: the instance is created with
 *   `anchors: true` so hash links delegate to lenis.scrollTo.
 * - Keyboard navigation must not break (no key-driven scrolling hijack).
 * - Touch must stay native on mobile: `syncTouch` is deliberately NOT enabled
 *   (default false = native touch, no scroll-jacking, §40).
 * - `respectReducedMotion` stays at its default (true): lenis refuses to start
 *   for reduced-motion users and the html element never gets `lenis-*` classes.
 * - `autoRaf` stays at its default (false): the ticker integration below owns
 *   the frame loop.
 * - Lenis own CSS (lenis/dist/lenis.css) is imported here so the page that
 *   wires Lenis automatically ships the `lenis`/`lenis-smooth` class rules.
 */

import 'lenis/dist/lenis.css';

import { gsap } from 'gsap';

import { getScrollTrigger } from './gsap';

export interface SmoothScrollOptions {
  /** Placeholder tuning values; replaced by experience design later. */
  lerp?: number;
  wheelMultiplier?: number;
}

export interface SmoothScrollHandle {
  /** The underlying Lenis instance, for ScrollTrigger integration. */
  lenis: import('lenis').default;
  /** Destroys the instance and restores native scrolling. */
  destroy: () => void;
}

/**
 * True when the user prefers reduced motion. Smooth scrolling must never be
 * enabled for these users (§25).
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Creates a Lenis instance wired to ScrollTrigger with the official recipe and
 * returns a handle with an explicit destroy().
 *
 * Returns `null` when the user prefers reduced motion: native scrolling is
 * preserved and nothing is attached to the window.
 */
export async function createSmoothScroll(
  options: SmoothScrollOptions = {},
): Promise<SmoothScrollHandle | null> {
  if (prefersReducedMotion()) {
    return null;
  }

  const { default: Lenis } = await import('lenis');

  const lenis = new Lenis({
    lerp: options.lerp ?? 0.1,
    wheelMultiplier: options.wheelMultiplier ?? 1,
    anchors: true,
  });

  try {
    // Official Lenis + ScrollTrigger integration (§39): ScrollTrigger.update on
    // every lenis scroll, and lenis.raf driven by the gsap ticker with lag
    // smoothing disabled. Exactly one rAF loop runs, and it is not ours.
    const scrollTrigger = await getScrollTrigger();
    lenis.on('scroll', scrollTrigger.update);

    const raf = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return {
      lenis,
      destroy: () => {
        // Remove exactly what this factory added, keeping the same references.
        gsap.ticker.remove(raf);
        lenis.off('scroll', scrollTrigger.update);
        lenis.destroy();
      },
    };
  } catch (error) {
    // Wiring failed mid-way (e.g. ScrollTrigger import rejected): tear the
    // instance down so no wheel/touch listeners outlive this factory, then
    // surface the failure to the caller.
    lenis.destroy();
    throw error;
  }
}
