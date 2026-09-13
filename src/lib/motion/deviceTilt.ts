import { gsap } from 'gsap';

import { prefersReducedMotion } from './gsap';

/**
 * Mobile device-tilt parallax + automatic permission pipeline (Fase 01 upgrade
 * v7 — spec §7.3.2/§7.4, DESIGN_SPEC §1.1/§1.1.2).
 *
 * v7 policy (RC-1/RC-2):
 * - The retry only listens on activation-qualifying interactions: `touchend`,
 *   `pointerup`, `click`, `mousedown`, `keydown`, plus `pointerdown` when
 *   `pointerType === 'mouse'`. `touchstart`/`wheel`/`scroll` never consume an
 *   attempt (they are not activation-triggering).
 * - `attempts` counts every `requestPermission()` call (the load attempt
 *   included) with a cap of 5 per page load. The pipeline terminates only on a
 *   resolved `'denied'` (label), `unsupported`, reduced motion or the cap;
 *   non-final results are never terminal and never show UI.
 * - After the first non-final result the single `deviceorientation` listener
 *   is attached optimistically (no UI): iOS stays inert pre-grant; Chromium
 *   revives the parallax when the platform actually delivers events. A later
 *   `'denied'` tears it down, zeroes the offsets and shows the label; a later
 *   `'granted'` keeps the same listener and starts the baseline if missing.
 * - Gate: `(pointer: coarse)` AND `Math.min(innerWidth, innerHeight) <= 800`
 *   (landscape phones in; large tablets out).
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

/** Activation-qualifying event types for the v7 retry (RC-1). */
const ACTIVATION_EVENTS = ['touchend', 'pointerup', 'click', 'mousedown', 'keydown'] as const;

/**
 * v7 (RC-1) — pure predicate behind the interaction retry (T5.7): only
 * activation-qualifying interactions may consume a permission attempt;
 * `pointerdown` qualifies for a mouse pointer only. Exported for the
 * Node-side matrix and the engine tests.
 */
export function isActivationQualifyingEvent(type: string, pointerType?: string): boolean {
  if (type === 'pointerdown') return pointerType === 'mouse';
  return (ACTIVATION_EVENTS as readonly string[]).includes(type);
}

/** Every event the retry arms; `pointerdown` is filtered by the predicate. */
const RETRY_EVENTS = [...ACTIVATION_EVENTS, 'pointerdown'] as const;

/** v7 (lead decision): 5 `requestPermission()` calls max per page load. */
const PERMISSION_ATTEMPT_CAP = 5;

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

/** v7 gate (DESIGN_SPEC §1.1.2): short side, so landscape phones qualify. */
function passesShortSideGate(): boolean {
  return Math.min(window.innerWidth, window.innerHeight) <= 800;
}

/**
 * Creates the device-tilt controller for coarse pointers with a short side
 * <= 800 px. Returns `null` on desktop/large tablets, without
 * `DeviceOrientationEvent` or under reduced motion (the caller already bails,
 * this keeps the contract local).
 */
export function createDeviceTilt(
  targets: DeviceTiltTargets,
  label: DeviceTiltLabel | null,
): DeviceTiltHandle | null {
  if (typeof window === 'undefined' || prefersReducedMotion()) return null;
  if (!window.matchMedia('(pointer: coarse)').matches || !passesShortSideGate()) return null;

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
  /** Single-listener invariant: one `deviceorientation` listener per lifetime. */
  let motionAttached = false;
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
  let optimistic = false;
  let state: TiltState = requestPermission ? 'pending' : 'auto';

  /** v7 movement gate: entry complete, listener attached, not paused/released. */
  const motionEnabled = () =>
    armed && !paused && !released && (state === 'granted' || state === 'auto' || optimistic);

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

  /**
   * Baseline is captured once, with the first 8 valid samples available while
   * movement is enabled (entry complete, listener attached, not paused).
   * Pre-entry samples only mark the optimistic flag (assumption 16).
   */
  const beginBaseline = () => {
    if (disposed || !motionAttached || !armed || paused) return;
    clearBaselineTimer();
    baselineSamples = [];
    baselineReady = false;
    smoothX = 0;
    smoothY = 0;
    baselineTimer = window.setTimeout(finishBaseline, BASELINE_TIMEOUT_MS);
  };

  const beginBaselineIfMissing = () => {
    if (baselineReady) return;
    beginBaseline();
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
    if (disposed) return;
    const { beta, gamma } = event;
    if (typeof beta !== 'number' || typeof gamma !== 'number') return;
    // RC-2: finite samples while the permission is still non-final mark the
    // optimistic path (the listener is attached optimistically by then).
    if (state !== 'granted' && state !== 'auto' && state !== 'denied') optimistic = true;
    if (!motionEnabled()) return;
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
    } else {
      beginBaseline(); // guard handles armed/attached
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
    if (disposed || !motionAttached || !armed) return;
    zeroOffsets();
    beginBaseline();
  };
  window.addEventListener('orientationchange', onOrientationChange);

  /** v7 single-listener invariant: the first attach wins; denied tears down. */
  function attachMotion(): void {
    if (motionAttached || disposed) return;
    motionAttached = true;
    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
  }

  function detachMotion(): void {
    if (!motionAttached) return;
    motionAttached = false;
    window.removeEventListener('deviceorientation', onDeviceOrientation);
  }

  function showLabel(): void {
    if (!labelNode || disposed) return;
    labelNode.root.hidden = false;
  }

  // --- permission pipeline (v7, automatic) -----------------------------------

  function removeGestureListeners(): void {
    if (!gestureArmed) return;
    gestureArmed = false;
    for (const type of RETRY_EVENTS) {
      window.removeEventListener(type, onGesture);
    }
  }

  /**
   * One interaction, one attempt. Non-qualifying events (touch pointerdown,
   * and anything not in RETRY_EVENTS) neither consume nor disarm the retry.
   */
  function onGesture(event: Event): void {
    const pointerType = (event as PointerEvent).pointerType;
    if (!isActivationQualifyingEvent(event.type, pointerType)) return;
    removeGestureListeners();
    if (disposed) return;
    attemptPermission();
  }

  /** Re-arm while the last result was non-final and attempts < cap (G3′). */
  function armGestureRetry(): void {
    if (disposed || gestureArmed) return;
    if (state === 'granted' || state === 'denied') return;
    if (attempts >= PERMISSION_ATTEMPT_CAP) return;
    gestureArmed = true;
    for (const type of RETRY_EVENTS) {
      window.addEventListener(type, onGesture, { passive: true });
    }
  }

  function handleResult(result: unknown): void {
    if (disposed) return;
    if (result === 'granted') {
      state = 'granted';
      attachMotion(); // no-op when the optimistic path already attached
      beginBaselineIfMissing();
      return;
    }
    if (result === 'denied') {
      // Terminal: tear the (possibly optimistic) listener down, release the
      // offsets and show the only visible UI (label) once the entry is done.
      state = 'denied';
      detachMotion();
      clearBaselineTimer();
      baselineSamples = [];
      baselineReady = false;
      optimistic = false;
      zeroOffsets();
      if (armed) showLabel();
      return;
    }
    // G3′/F1: 'prompt' / 'default' / undefined / unknown strings are
    // non-final. Never terminal, never a denial, never a label; attach the
    // motion listener optimistically and re-arm below the cap.
    state = 'prompt-unknown';
    attachMotion();
    beginBaselineIfMissing();
    armGestureRetry();
  }

  function handleFailure(): void {
    if (disposed) return;
    // Non-final rejection (e.g. NotAllowedError without transient activation).
    state = 'pending';
    attachMotion();
    beginBaselineIfMissing();
    armGestureRetry();
  }

  function attemptPermission(): void {
    if (disposed || !requestPermission) return;
    if (state === 'granted' || state === 'denied') return;
    if (attempts >= PERMISSION_ATTEMPT_CAP) return;
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
    attemptPermission(); // load attempt, no interaction
  } else {
    attachMotion(); // Android `auto`: listener at init, movement after entry
  }

  return {
    arm() {
      if (disposed || armed) return;
      armed = true;
      if (state === 'denied') {
        showLabel();
        return;
      }
      if (state === 'granted' || state === 'auto') {
        attachMotion();
      }
      beginBaselineIfMissing();
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
      detachMotion();
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
