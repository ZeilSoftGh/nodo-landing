import { gsap } from 'gsap';

import { prefersReducedMotion } from './gsap';

/**
 * Mobile device-tilt parallax + automatic permission pipeline (Fase 01 upgrade
 * v5 — spec §7.3.2/§7.4, DESIGN_SPEC §1.1/§1.1.1).
 *
 * There is no interactive control: on init the module calls
 * `requestPermission()` once with no interaction; non-final results
 * (`'prompt'`, `'default'`, `undefined`, unknown strings, rejections) are
 * never treated as a denial (F1) and arm a one-shot passive retry on the
 * first of pointerdown/touchstart/wheel/scroll/keydown. Only a resolved
 * `'denied'` reveals the non-interactive label. The sensor listener attaches
 * only after `arm()` (entry complete) AND a grant (or Android `auto`).
 *
 * F2/D20: `setReleased(true/false)` is invoked by the intro timeline's
 * `onUpdate` on the 0.003 crossing — not by input events.
 */

export interface DeviceTiltTargets {
  /** The clock `<img>` (input) — the scrub writes to the container instead. */
  clockImg: HTMLElement;
  /** `.experience-sky__sparks` layer. */
  sparks: HTMLElement;
  /** `.experience-sky__dust` layer. */
  dust: HTMLElement;
}

export interface DeviceTiltLabel {
  /** `<p data-experience-tilt role="status" hidden>` (denied label). */
  root: HTMLElement;
}

export interface DeviceTiltHandle {
  /** `homeExperience` calls this once, when the entry timeline completes. */
  arm(): void;
  /** F2: true = setters to 0 and samples blocked; false = re-arm. */
  setReleased(released: boolean): void;
  destroy(): void;
}

const GESTURE_EVENTS = ['pointerdown', 'touchstart', 'wheel', 'scroll', 'keydown'] as const;

const BASELINE_SAMPLES = 8;
const BASELINE_TIMEOUT_MS = 320;
const DEADZONE_DEG = 1.5;
const FULL_SCALE_DEG = 25;
const EMA_ALPHA = 0.2;
const CLOCK_MAX_X_PX = 24;
const CLOCK_X_VW_FACTOR = 0.062;
const CLOCK_Y_PX = 14;
/** v5 star depths (D21): sparks 48 %, dust 36 % of the clock offset. */
const SPARKS_DEPTH = 0.48;
const DUST_DEPTH = 0.36;
const SPARKS_ROTATION_DEG = 0.45;
const DUST_ROTATION_DEG = 0.34;

type TiltState = 'auto' | 'pending' | 'prompt-unknown' | 'requesting' | 'granted' | 'denied';

/**
 * Creates the device-tilt controller for coarse pointers <= 800 px. Returns
 * `null` on desktop, without `DeviceOrientationEvent` or under reduced motion
 * (the caller already bails, this keeps the contract local).
 */
export function createDeviceTilt(
  targets: DeviceTiltTargets,
  label: DeviceTiltLabel | null,
): DeviceTiltHandle | null {
  if (typeof window === 'undefined' || prefersReducedMotion()) return null;
  if (!window.matchMedia('(pointer: coarse)').matches || window.innerWidth > 800) return null;

  const deviceOrientation = window.DeviceOrientationEvent as
    (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<unknown> }) | undefined;
  if (!deviceOrientation) return null; // unsupported: never listens

  const requestPermission =
    typeof deviceOrientation.requestPermission === 'function'
      ? deviceOrientation.requestPermission
      : null;

  const { clockImg, sparks, dust } = targets;
  const labelNode = label;

  const clockX = gsap.quickTo(clockImg, 'x', { duration: 1, ease: 'power2.out' });
  const clockY = gsap.quickTo(clockImg, 'y', { duration: 1, ease: 'power2.out' });
  const sparksX = gsap.quickTo(sparks, 'x', { duration: 1, ease: 'power2.out' });
  const sparksY = gsap.quickTo(sparks, 'y', { duration: 1, ease: 'power2.out' });
  const sparksRotation = gsap.quickTo(sparks, 'rotation', { duration: 1, ease: 'power2.out' });
  const dustX = gsap.quickTo(dust, 'x', { duration: 1.5, ease: 'power2.out' });
  const dustY = gsap.quickTo(dust, 'y', { duration: 1.5, ease: 'power2.out' });
  const dustRotation = gsap.quickTo(dust, 'rotation', { duration: 1.5, ease: 'power2.out' });

  const setters = [clockX, clockY, sparksX, sparksY, sparksRotation, dustX, dustY, dustRotation];

  let disposed = false;
  let armed = false;
  let attached = false;
  let paused = false;
  let released = false;
  let baselineReady = false;
  let beta0 = 0;
  let gamma0 = 0;
  let baselineSamples: Array<{ beta: number; gamma: number }> = [];
  let baselineTimer: number | null = null;
  let smoothX = 0;
  let smoothY = 0;
  let attempts = 0;
  let gestureArmed = false;
  let state: TiltState = requestPermission ? 'pending' : 'auto';

  const zeroOffsets = () => {
    for (const setter of setters) {
      setter(0);
    }
  };

  const clearBaselineTimer = () => {
    if (baselineTimer !== null) {
      window.clearTimeout(baselineTimer);
      baselineTimer = null;
    }
  };

  function finishBaseline(): void {
    clearBaselineTimer();
    if (baselineSamples.length > 0) {
      let betaSum = 0;
      let gammaSum = 0;
      for (const sample of baselineSamples) {
        betaSum += sample.beta;
        gammaSum += sample.gamma;
      }
      beta0 = betaSum / baselineSamples.length;
      gamma0 = gammaSum / baselineSamples.length;
      baselineReady = true;
    }
    baselineSamples = [];
  }

  const beginBaseline = () => {
    if (disposed || !attached) return;
    clearBaselineTimer();
    baselineSamples = [];
    baselineReady = false;
    smoothX = 0;
    smoothY = 0;
    baselineTimer = window.setTimeout(finishBaseline, BASELINE_TIMEOUT_MS);
  };

  const normalize = (delta: number): number => {
    if (Math.abs(delta) <= DEADZONE_DEG) return 0;
    return Math.max(-1, Math.min(1, delta / FULL_SCALE_DEG));
  };

  const applySample = (beta: number, gamma: number) => {
    const dx = gamma - gamma0;
    const dy = beta - beta0;
    // Device frame is portrait-relative (MDN): rotate the tilt vector by the
    // screen angle. Portrait (0) is the identity under test (DESIGN_SPEC §1.2).
    const angle = ((screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI) / 180;
    const nx = dx * Math.cos(angle) + dy * Math.sin(angle);
    const ny = -dx * Math.sin(angle) + dy * Math.cos(angle);
    smoothX += EMA_ALPHA * (normalize(nx) - smoothX);
    smoothY += EMA_ALPHA * (normalize(ny) - smoothY);

    const amplitudeX = Math.min(CLOCK_MAX_X_PX, CLOCK_X_VW_FACTOR * window.innerWidth);
    const amplitudeY = CLOCK_Y_PX;
    clockX(smoothX * amplitudeX);
    clockY(smoothY * amplitudeY);
    sparksX(smoothX * amplitudeX * SPARKS_DEPTH);
    sparksY(smoothY * amplitudeY * SPARKS_DEPTH);
    sparksRotation(smoothX * SPARKS_ROTATION_DEG);
    dustX(smoothX * amplitudeX * DUST_DEPTH);
    dustY(smoothY * amplitudeY * DUST_DEPTH);
    dustRotation(smoothX * DUST_ROTATION_DEG);
  };

  const onDeviceOrientation = (event: DeviceOrientationEvent) => {
    if (disposed || paused || released) return;
    const { beta, gamma } = event;
    if (typeof beta !== 'number' || typeof gamma !== 'number') return;
    if (!baselineReady) {
      baselineSamples.push({ beta, gamma });
      if (baselineSamples.length >= BASELINE_SAMPLES) finishBaseline();
      return;
    }
    applySample(beta, gamma);
  };

  const setPaused = (next: boolean) => {
    if (disposed || paused === next) return;
    paused = next;
    if (paused) {
      zeroOffsets();
      clearBaselineTimer();
      baselineSamples = [];
      baselineReady = false;
    } else if (attached) {
      beginBaseline();
    }
  };

  // Off-screen pause: the observer watches the whole intro section.
  const introSection = clockImg.closest<HTMLElement>('[data-experience-intro]');
  let observer: IntersectionObserver | null = null;
  if (introSection && typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      setPaused(!entry.isIntersecting);
    });
    observer.observe(introSection);
  }

  const onVisibilityChange = () => setPaused(document.hidden);
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Re-capture the held posture after a rotation (D10); landscape stays
  // outside the no-occlusion contract and its sign is pending real-device QA.
  const onOrientationChange = () => {
    if (!attached || disposed) return;
    zeroOffsets();
    beginBaseline();
  };
  window.addEventListener('orientationchange', onOrientationChange);

  function attach(): void {
    if (attached || disposed) return;
    attached = true;
    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
    if (!paused) beginBaseline();
  }

  function startIfReady(): void {
    if (disposed || attached || !armed) return;
    if (state === 'granted' || state === 'auto') attach();
  }

  function showLabel(): void {
    if (!labelNode || disposed) return;
    labelNode.root.hidden = false;
  }

  // --- permission pipeline (v5, automatic) -----------------------------------

  function removeGestureListeners(): void {
    if (!gestureArmed) return;
    gestureArmed = false;
    for (const type of GESTURE_EVENTS) {
      window.removeEventListener(type, onGesture);
    }
  }

  function onGesture(): void {
    removeGestureListeners();
    if (disposed) return;
    attemptPermission();
  }

  /** One-shot retry: only while the first attempt was non-final (F1). */
  function armGestureRetry(): void {
    if (disposed || gestureArmed || attempts >= 2) return;
    gestureArmed = true;
    for (const type of GESTURE_EVENTS) {
      window.addEventListener(type, onGesture, { passive: true });
    }
  }

  function handleResult(result: unknown): void {
    if (disposed) return;
    if (result === 'granted') {
      state = 'granted';
      startIfReady();
      return;
    }
    if (result === 'denied') {
      state = 'denied';
      if (armed) showLabel();
      return;
    }
    // F1: 'prompt' / 'default' / undefined / unknown strings are retryable;
    // they never produce `denied` and never show the label.
    state = 'prompt-unknown';
    armGestureRetry();
  }

  function handleFailure(): void {
    if (disposed) return;
    // F1: rejections (e.g. NotAllowedError without transient activation) are
    // not denials; they only arm the one-shot gesture retry.
    state = 'pending';
    armGestureRetry();
  }

  function attemptPermission(): void {
    if (disposed || !requestPermission) return;
    if (attempts >= 2) return; // one load attempt + one gesture retry, no more
    attempts += 1;
    state = 'requesting';
    let permission: Promise<unknown>;
    try {
      permission = Promise.resolve(requestPermission.call(deviceOrientation));
    } catch {
      handleFailure();
      return;
    }
    void permission.then(handleResult).catch(handleFailure);
  }

  if (requestPermission) {
    attemptPermission();
  }

  return {
    arm() {
      if (disposed || armed) return;
      armed = true;
      if (state === 'granted' || state === 'auto') {
        startIfReady();
      } else if (state === 'denied') {
        showLabel();
      }
    },
    setReleased(next: boolean) {
      if (released === next) return;
      released = next;
      if (next) {
        zeroOffsets();
      } else {
        smoothX = 0;
        smoothY = 0;
      }
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      removeGestureListeners();
      window.removeEventListener('deviceorientation', onDeviceOrientation);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('orientationchange', onOrientationChange);
      observer?.disconnect();
      observer = null;
      clearBaselineTimer();
      for (const setter of setters) {
        setter.tween?.kill();
      }
      gsap.set([clockImg, sparks, dust], { x: 0, y: 0, rotation: 0 });
    },
  };
}
