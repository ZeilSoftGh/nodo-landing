/**
 * Smooth-scroll abstraction for Lenis (§24).
 *
 * Constraints that MUST be respected when this factory is first used for real:
 * - Nothing here initializes Lenis globally or alters native scroll by default.
 * - Must integrate with GSAP ScrollTrigger (call ScrollTrigger.update on lenis
 *   scroll events and drive lenis via gsap.ticker when wired up).
 * - Must not break anchor navigation (wire lenis.scrollTo to hash links).
 * - Must not break keyboard navigation (do not hijack key-driven scrolling).
 * - Must not block scrolling on mobile (keep native touch behavior).
 */

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
 * Creates a Lenis instance and returns a handle with an explicit destroy().
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
  });

  return {
    lenis,
    destroy: () => {
      lenis.destroy();
    },
  };
}
