import { gsap } from 'gsap';

/**
 * Desktop pointer parallax (Fase 01 upgrade, v5 deltas — spec §7.3.1).
 *
 * One passive `pointermove` listener drives eight `gsap.quickTo` setters that
 * are created exactly once. The module owns only `x`/`y`/`rotation` on its
 * targets (the scrub owns `yPercent`/`scale`/`opacity`), so pointer and scrub
 * never fight for the same property.
 *
 * F2/D20: the scrub release is a state transition triggered by the intro
 * timeline's `onUpdate` crossing 0.003 — `setReleased(true)` zeroes every
 * setter once and blocks input; `setReleased(false)` re-arms. Nothing waits
 * for the next input event.
 *
 * Reduced motion is filtered by `initHomeExperience` before creation, and the
 * factory also refuses coarse pointers / narrow viewports (no listener at all).
 */

export interface PointerParallaxOptions {
  /** The clock `<img>` (input) — the scrub writes to the container instead. */
  clockImg: HTMLElement;
  /** `.experience-sky__sparks` layer. */
  sparks: HTMLElement;
  /** `.experience-sky__dust` layer. */
  dust: HTMLElement;
}

export interface PointerParallaxHandle {
  /** F2: true = setters to 0 and input blocked; false = re-arm. */
  setReleased(released: boolean): void;
  destroy(): void;
}

/**
 * Creates the desktop pointer parallax. Returns `null` on non-fine-pointer /
 * <=800 px devices (nothing is attached).
 */
export function createPointerParallax(
  options: PointerParallaxOptions,
): PointerParallaxHandle | null {
  const { clockImg, sparks, dust } = options;

  if (typeof window === 'undefined' || !isFinePointer()) {
    return null;
  }

  const clockX = gsap.quickTo(clockImg, 'x', { duration: 1, ease: 'power2.out' });
  const clockY = gsap.quickTo(clockImg, 'y', { duration: 1, ease: 'power2.out' });
  const sparksX = gsap.quickTo(sparks, 'x', { duration: 1, ease: 'power2.out' });
  const sparksY = gsap.quickTo(sparks, 'y', { duration: 1, ease: 'power2.out' });
  const sparksRotation = gsap.quickTo(sparks, 'rotation', { duration: 1, ease: 'power2.out' });
  const dustX = gsap.quickTo(dust, 'x', { duration: 1.5, ease: 'power2.out' });
  const dustY = gsap.quickTo(dust, 'y', { duration: 1.5, ease: 'power2.out' });
  const dustRotation = gsap.quickTo(dust, 'rotation', { duration: 1.5, ease: 'power2.out' });

  const setters = [clockX, clockY, sparksX, sparksY, sparksRotation, dustX, dustY, dustRotation];

  let released = false;

  const zeroOffsets = () => {
    for (const setter of setters) {
      setter(0);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (released) return;

    // Guards are re-evaluated per event (breakpoint crossing at runtime does
    // not recreate listeners, spec §7.3.1).
    if (!isFinePointer()) return;

    // v5 star amplitudes (D21): sparks /32 + rot /2000, dust /40 + rot /2600.
    // The clock keeps its occlusion budget (/15).
    const offsetX = event.clientX - window.innerWidth / 2;
    const offsetY = event.clientY - window.innerHeight / 2;
    clockX(offsetX / 15);
    clockY(offsetY / 15);
    sparksX(offsetX / 32);
    sparksY(offsetY / 32);
    sparksRotation(offsetX / 2000);
    dustX(offsetX / 40);
    dustY(offsetY / 40);
    dustRotation(offsetX / 2600);
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });

  return {
    setReleased(next: boolean) {
      if (released === next) return;
      released = next;
      if (next) zeroOffsets();
    },
    destroy() {
      window.removeEventListener('pointermove', onPointerMove);
      for (const setter of setters) {
        setter.tween?.kill();
      }
    },
  };
}

function isFinePointer(): boolean {
  return window.matchMedia('(pointer: fine)').matches && window.innerWidth > 800;
}
