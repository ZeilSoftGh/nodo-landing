import { gsap } from 'gsap';

/**
 * Central GSAP configuration for the project (§23).
 *
 * Rules:
 * - Plugins are registered lazily, only when actually needed.
 * - Nothing runs at module import time (no timelines, no effects).
 * - Every exported initializer returns an explicit cleanup function.
 */

export interface ScrollAnimationOptions {
  /** CSS selector or element to animate. */
  target: string | Element | Element[];
  /** Initial vertical offset in px (placeholder value, not a design token). */
  y?: number;
  /** Duration in seconds (placeholder value, not a design token). */
  duration?: number;
  /** ScrollTrigger start position (placeholder value, not a design token). */
  start?: string;
}

/**
 * True when the user prefers reduced motion. All motion utilities must check
 * this and degrade to a functional experience without heavy animation (§25).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Lazily loaded ScrollTrigger singleton. registerPlugin is only called the
// first time a scroll animation is actually created.
let scrollTriggerLoader: Promise<void> | null = null;

async function ensureScrollTriggerRegistered(): Promise<void> {
  scrollTriggerLoader ??= import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
    gsap.registerPlugin(ScrollTrigger);
  });
  await scrollTriggerLoader;
}

/**
 * Resolves the ScrollTrigger plugin class after registering it on the shared
 * gsap singleton. Kept lazy (§36): the plugin is only imported and registered
 * when a scroll-driven animation actually needs it, so pages without scroll
 * animation never pay for it. Reuses the loader above, so registration happens
 * exactly once no matter how many callers await this (§61: one place registers
 * plugins, not five).
 */
export async function getScrollTrigger() {
  await ensureScrollTriggerRegistered();
  const { ScrollTrigger } = await import('gsap/ScrollTrigger');
  return ScrollTrigger;
}

/**
 * Creates a placeholder scroll-driven entrance animation and returns a cleanup
 * function that kills the tween and its ScrollTrigger instance.
 *
 * Reduced motion: degrades to a no-op initializer + no-op cleanup.
 */
export async function createScrollAnimation(options: ScrollAnimationOptions): Promise<() => void> {
  if (prefersReducedMotion()) {
    return () => {};
  }

  await ensureScrollTriggerRegistered();

  const tween = gsap.fromTo(
    options.target,
    { autoAlpha: 0, y: options.y ?? 24 },
    {
      autoAlpha: 1,
      y: 0,
      duration: options.duration ?? 0.6,
      scrollTrigger: {
        trigger: options.target,
        start: options.start ?? 'top 85%',
      },
    },
  );

  return () => {
    tween.scrollTrigger?.kill();
    tween.kill();
  };
}
