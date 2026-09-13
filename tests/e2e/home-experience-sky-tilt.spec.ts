import { devices, expect, test, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

import { isActivationQualifyingEvent } from '../../src/lib/motion/deviceTilt';

/**
 * Fase 01 upgrade (v4 + deltas v5/v6) — sky + pointer/gyro tilt + lateral exit
 * + automatic permission pipeline + intro→film continuity + clock landing.
 *
 * Spec: docs/superpowers/specs/2026-09-10-experience-intro-sky-tilt-design.md
 * Design: docs/design/experience-intro/DESIGN_SPEC.md (v6) + particles.json +
 * clock-bbox.json + sparks.json.
 *
 * All assertions are DOM/geometry based (R5): no visual snapshots. The single
 * exception is C2, which samples a 1×1 screenshot and decodes it inline with
 * `node:zlib` (no new dependencies). Permission states are simulated per
 * DESIGN_SPEC §8 via `addInitScript`.
 */

const repoRoot = process.cwd();

interface SkySpark {
  index: number;
  leftPct: number;
  topPct: number;
  sizePxDesktop: number;
  sizePxMobile: number;
  opacity: number;
  rotationDeg: number;
  tone: 'gold' | 'gold-soft';
  twinkle: boolean;
  twinkleDelaySec: number | null;
  visibleMobile: boolean;
  mobileOverride: { leftPct: number; topPct: number } | null;
}

interface SkySparksFile {
  countDesktop: number;
  countMobile: number;
  hiddenOnMobile: number[];
  twinkle: { indices: number[]; animation: string };
  sparks: SkySpark[];
}

interface ClockBboxFile {
  canvas: { w: number; h: number };
  threshold: number;
  fx: { x0: number; x1: number; y0: number; y1: number };
}

interface Matrix {
  m11: number;
  m12: number;
  m21: number;
  m22: number;
  m41: number;
  m42: number;
}

interface TestWindow {
  __tiltPermissionCalls?: number;
  __listenerCounts?: Record<string, number>;
  __listenerRemovals?: Record<string, number>;
}

type PermissionMode =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unknown'
  | 'reject'
  | 'prompt-then-denied'
  | 'prompt-then-granted'
  | 'android'
  | 'unsupported';

/**
 * v7 (RC-1): the interaction retry arms these types; `pointerdown` only
 * qualifies when `pointerType === 'mouse'` (filtered by the pure predicate).
 */
const RETRY_EVENTS = [
  'touchend',
  'pointerup',
  'click',
  'mousedown',
  'keydown',
  'pointerdown',
] as const;

/** v7 (RC-1): non-activation events must never consume an attempt. */
const NON_ACTIVATION_EVENTS = ['touchstart', 'wheel', 'scroll'] as const;

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8')) as T;
}

function skySparks(): SkySparksFile {
  return readJson<SkySparksFile>('src/lib/experience/sky-sparks.json');
}

function clockBbox(): ClockBboxFile {
  return readJson<ClockBboxFile>('docs/design/experience-intro/clock-bbox.json');
}

// --- context helpers ---------------------------------------------------------

async function withDesktop(
  browser: Browser,
  viewport: { width: number; height: number },
  run: (page: Page) => Promise<void>,
  options: { reducedMotion?: 'reduce'; init?: () => void } = {},
): Promise<void> {
  const context = await browser.newContext({
    viewport,
    ...(options.reducedMotion ? { reducedMotion: options.reducedMotion } : {}),
  });
  try {
    if (options.init) await context.addInitScript(options.init);
    const page = await context.newPage();
    await page.goto('/');
    await run(page);
  } finally {
    await context.close();
  }
}

/**
 * Mobile context (iPhone 13 emulation). `permission` stubs
 * `DeviceOrientationEvent.requestPermission` for the requested state and spies
 * the calls in `window.__tiltPermissionCalls`; `extra` adds another init
 * script (e.g. the listener counter).
 */
async function withMobile(
  browser: Browser,
  viewport: { width: number; height: number },
  options: { permission?: PermissionMode; extra?: () => void; reducedMotion?: 'reduce' } | null,
  run: (page: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    viewport,
    screen: viewport,
    ...(options?.reducedMotion ? { reducedMotion: options.reducedMotion } : {}),
  });
  try {
    if (options?.permission) {
      await context.addInitScript((mode: string) => {
        const testWindow = window as unknown as TestWindow;
        testWindow.__tiltPermissionCalls = 0;
        const existing = (window as unknown as { DeviceOrientationEvent?: unknown })
          .DeviceOrientationEvent;
        if (mode === 'unsupported') {
          delete (window as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent;
          return;
        }
        if (typeof existing === 'undefined') return;
        const ctor = existing as Record<string, unknown>;
        if (mode === 'android') {
          delete ctor.requestPermission;
          return;
        }
        ctor.requestPermission = () => {
          testWindow.__tiltPermissionCalls = (testWindow.__tiltPermissionCalls ?? 0) + 1;
          if (mode === 'prompt-then-denied') {
            return Promise.resolve(
              (testWindow.__tiltPermissionCalls ?? 0) > 1 ? 'denied' : 'prompt',
            );
          }
          if (mode === 'prompt-then-granted') {
            return Promise.resolve(
              (testWindow.__tiltPermissionCalls ?? 0) > 1 ? 'granted' : 'prompt',
            );
          }
          if (mode === 'granted') return Promise.resolve('granted');
          if (mode === 'denied') return Promise.resolve('denied');
          if (mode === 'prompt') return Promise.resolve('prompt');
          if (mode === 'unknown') return Promise.resolve(undefined);
          if (mode === 'reject') {
            return Promise.reject(new DOMException('activation', 'NotAllowedError'));
          }
          return Promise.resolve('granted');
        };
      }, options.permission);
    }
    if (options?.extra) await context.addInitScript(options.extra);
    const page = await context.newPage();
    await page.goto('/');
    await run(page);
  } finally {
    await context.close();
  }
}

/** Counts add/removeEventListener calls per type (retry self-removal checks). */
function listenerSpyInit(): void {
  const testWindow = window as unknown as TestWindow;
  testWindow.__listenerCounts = {};
  testWindow.__listenerRemovals = {};
  const originalAdd = EventTarget.prototype.addEventListener;
  const originalRemove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    const counts = testWindow.__listenerCounts ?? {};
    counts[type] = (counts[type] ?? 0) + 1;
    testWindow.__listenerCounts = counts;
    return originalAdd.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) {
    const removals = testWindow.__listenerRemovals ?? {};
    removals[type] = (removals[type] ?? 0) + 1;
    testWindow.__listenerRemovals = removals;
    return originalRemove.call(this, type, listener, options);
  };
}

// --- page helpers ------------------------------------------------------------

async function readTransform(page: Page, selector: string): Promise<Matrix> {
  return page.evaluate((sel) => {
    const node = document.querySelector(sel);
    if (!node) throw new Error(`missing node: ${sel}`);
    const value = getComputedStyle(node).transform;
    const matrix = new DOMMatrixReadOnly(value === 'none' ? undefined : value);
    return {
      m11: matrix.m11,
      m12: matrix.m12,
      m21: matrix.m21,
      m22: matrix.m22,
      m41: matrix.m41,
      m42: matrix.m42,
    };
  }, selector);
}

function rotationOf(matrix: Matrix): number {
  return (Math.atan2(matrix.m12, matrix.m11) * 180) / Math.PI;
}

async function readStabilitySnapshot(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const selectors = [
      'img[src="/reloj.png"]',
      '[data-experience-clock]',
      '.experience-intro__line',
      '[data-experience-sky-dust]',
      '[data-experience-sky-sparks]',
    ];
    const values: number[] = [window.scrollY];
    for (const selector of selectors) {
      for (const node of Array.from(document.querySelectorAll(selector))) {
        const rect = node.getBoundingClientRect();
        values.push(rect.left, rect.top, rect.width, rect.height);
      }
    }
    return values;
  });
}

/** Waits for scroll + transforms to hold two consecutive reads (0.25 px). */
async function waitForSettledLayout(page: Page, timeoutMs = 8000): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const deadline = Date.now() + timeoutMs;
  let previous = await readStabilitySnapshot(page);
  while (Date.now() < deadline) {
    await page.waitForTimeout(80);
    const next = await readStabilitySnapshot(page);
    let stable = next.length === previous.length;
    if (stable) {
      for (let i = 0; i < next.length; i += 1) {
        if (Math.abs(next[i] - previous[i]) > 0.25) {
          stable = false;
          break;
        }
      }
    }
    if (stable) return;
    previous = next;
  }
}

async function introProgress(page: Page): Promise<number> {
  return page.evaluate(() => {
    const section = document.querySelector('[data-experience-intro]');
    if (!(section instanceof HTMLElement)) throw new Error('intro section missing');
    const rect = section.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const distance = Math.max(0, section.offsetHeight - window.innerHeight);
    return distance > 0 ? (window.scrollY - top) / distance : 0;
  });
}

/** Scrolls the intro scrub to `target` and returns the achieved progress. */
async function scrollToProgress(page: Page, target: number): Promise<number> {
  await page.evaluate((progress) => {
    const section = document.querySelector('[data-experience-intro]');
    if (!(section instanceof HTMLElement)) throw new Error('intro section missing');
    const rect = section.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const distance = Math.max(0, section.offsetHeight - window.innerHeight);
    window.scrollTo(0, top + distance * progress);
  }, target);
  await waitForSettledLayout(page);
  return introProgress(page);
}

async function waitForEntry(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const clock = document.querySelector('[data-experience-clock]');
          return clock ? getComputedStyle(clock).opacity : '0';
        }),
      { timeout: 15000 },
    )
    .toBe('1');
  await page.waitForTimeout(200);
}

async function movePointerAndSettle(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y);
  // The dust quickTo runs 1.5 s (spec §7.3.1); wait past it so S1 tolerances
  // are measured on the settled values.
  await page.waitForTimeout(1700);
}

async function dispatchOrientation(page: Page, beta: number, gamma: number): Promise<void> {
  await page.evaluate(
    ({ b, g }) => {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: b, gamma: g }));
    },
    { b: beta, g: gamma },
  );
}

async function dispatchOrientationSeries(
  page: Page,
  beta: number,
  gamma: number,
  times: number,
): Promise<void> {
  await page.evaluate(
    ({ b, g, n }) => {
      for (let i = 0; i < n; i += 1) {
        window.dispatchEvent(
          new DeviceOrientationEvent('deviceorientation', { beta: b, gamma: g }),
        );
      }
    },
    { b: beta, g: gamma, n: times },
  );
}

/**
 * Dispatches one interaction event on `window`. Touch types use a real
 * `TouchEvent` when constructible (WebKit and Chromium both support it) and
 * fall back to a plain `Event`; `pointerType` is passed for `PointerEvent`s so
 * the v7 `pointerdown` filter can be exercised.
 */
async function dispatchGesture(page: Page, type: string, pointerType?: string): Promise<void> {
  await page.evaluate(
    ({ eventType, pointer }) => {
      let event: Event;
      if (pointer) {
        event = new PointerEvent(eventType, { pointerType: pointer, bubbles: true });
      } else if (eventType.startsWith('touch')) {
        try {
          event = new TouchEvent(eventType, { bubbles: true });
        } catch {
          event = new Event(eventType, { bubbles: true });
        }
      } else {
        event = new Event(eventType, { bubbles: true });
      }
      window.dispatchEvent(event);
    },
    { eventType: type, pointer: pointerType ?? null },
  );
}

/**
 * Baseline posture (95/12) held for 8 valid samples, then a full-scale
 * stimulus (delta +/-25 deg) repeated to let the EMA (alpha 0.2) converge.
 */
async function setGyro(page: Page, nx: number, ny: number): Promise<void> {
  await dispatchOrientationSeries(page, 95, 12, 8);
  await dispatchOrientationSeries(page, 95 + 25 * ny, 12 + 25 * nx, 30);
  await page.waitForTimeout(1250);
}

interface Clearance {
  boxGap: number;
  inkGap: number;
  measuredLines: number;
}

/**
 * Worst vertical clearance between the clock's *visible* bbox (alpha >= 16,
 * exact fractions of clock-bbox.json) and every on-screen
 * `.experience-intro__line` box / ink rect. Lines fully outside the viewport
 * are gated out (v6 landing: the title is long gone at 0.65+). Negative =
 * vertical overlap.
 */
async function measureClearance(page: Page): Promise<Clearance> {
  const fx = clockBbox().fx;
  return page.evaluate((fractions) => {
    const img = document.querySelector('img[src="/reloj.png"]');
    if (!img) throw new Error('clock image missing');
    const rect = img.getBoundingClientRect();
    const clock = {
      top: rect.top + rect.height * fractions.y0,
      bottom: rect.top + rect.height * fractions.y1,
    };
    const onScreen = (candidate: { left: number; right: number; top: number; bottom: number }) =>
      candidate.right > 1 &&
      candidate.left < window.innerWidth - 1 &&
      candidate.bottom > 1 &&
      candidate.top < window.innerHeight - 1;
    const gapOf = (candidate: { top: number; bottom: number }) => {
      if (candidate.bottom <= clock.top) return clock.top - candidate.bottom;
      if (candidate.top >= clock.bottom) return candidate.top - clock.bottom;
      return -Math.min(clock.bottom - candidate.top, candidate.bottom - clock.top);
    };
    let boxGap = Number.POSITIVE_INFINITY;
    let inkGap = Number.POSITIVE_INFINITY;
    let measuredLines = 0;
    for (const line of Array.from(document.querySelectorAll('.experience-intro__line'))) {
      const lineBox = line.getBoundingClientRect();
      if (!onScreen(lineBox)) continue;
      measuredLines += 1;
      boxGap = Math.min(boxGap, gapOf(lineBox));
      const range = document.createRange();
      range.selectNodeContents(line);
      for (const ink of Array.from(range.getClientRects())) {
        if (ink.width <= 0 || ink.height <= 0 || !onScreen(ink)) continue;
        inkGap = Math.min(inkGap, gapOf(ink));
      }
    }
    return { boxGap, inkGap, measuredLines };
  }, fx);
}

interface LandingProbe {
  dock: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  clockCenter: { x: number; y: number };
  clockVisibleHeight: number;
  clockWidth: number;
  scale: number;
  opacity: string;
  filter: string;
  wrapperStyle: string;
}

/** Measures the landing state: dock box + clock visible bbox center/height. */
async function readLanding(page: Page): Promise<LandingProbe> {
  const fx = clockBbox().fx;
  return page.evaluate((fractions) => {
    const dock = document.querySelector('[data-experience-dock]');
    const img = document.querySelector('img[src="/reloj.png"]');
    const wrapper = document.querySelector<HTMLElement>('[data-experience-clock]');
    if (!dock || !img || !wrapper) throw new Error('landing nodes missing');
    const rect = img.getBoundingClientRect();
    const visible = {
      left: rect.left + rect.width * fractions.x0,
      right: rect.left + rect.width * fractions.x1,
      top: rect.top + rect.height * fractions.y0,
      bottom: rect.top + rect.height * fractions.y1,
    };
    const wrapperStyle = getComputedStyle(wrapper);
    const matrix = new DOMMatrixReadOnly(
      wrapperStyle.transform === 'none' ? undefined : wrapperStyle.transform,
    );
    const dockRect = dock.getBoundingClientRect().toJSON();
    return {
      dock: dockRect,
      clockCenter: {
        x: (visible.left + visible.right) / 2,
        y: (visible.top + visible.bottom) / 2,
      },
      clockVisibleHeight: visible.bottom - visible.top,
      clockWidth: wrapper.offsetWidth,
      scale: Math.hypot(matrix.m11, matrix.m12),
      opacity: wrapperStyle.opacity,
      filter: wrapperStyle.filter,
      wrapperStyle: wrapper.getAttribute('style') ?? '',
    };
  }, fx);
}

/**
 * Decodes the top-left pixel of a PNG buffer (Node zlib only). For the first
 * pixel every PNG filter type reduces to the raw channel bytes (no prior
 * pixels), so no scanline reconstruction is needed.
 */
function decodePngTopLeft(buffer: Buffer): { r: number; g: number; b: number } {
  let offset = 8;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (bitDepth !== 8) throw new Error(`unexpected PNG bit depth: ${bitDepth}`);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (channels === 0) throw new Error(`unexpected PNG color type: ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  if (raw[0] > 4) throw new Error(`unexpected PNG filter: ${raw[0]}`);
  return { r: raw[1], g: raw[2], b: raw[3] };
}

/** Samples one CSS pixel of the current viewport. */
async function samplePixel(
  page: Page,
  x: number,
  y: number,
): Promise<{ r: number; g: number; b: number }> {
  const buffer = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  return decodePngTopLeft(buffer);
}

function channelDelta(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

// --- 1. sky structure --------------------------------------------------------

test.describe('sky structure (desktop)', () => {
  test('sky, dock and denied label: order, decorativeness and no interactive control', async ({
    page,
  }) => {
    await page.goto('/');

    const sky = page.locator('[data-experience-sky]');
    await expect(sky).toHaveCount(1);
    await expect(sky).toHaveAttribute('aria-hidden', 'true');
    expect(await sky.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');

    const order = await page.evaluate(() => {
      const viewport = document.querySelector('.experience-intro__viewport');
      if (!viewport) throw new Error('viewport missing');
      return Array.from(viewport.children).map((el) => {
        if (el.matches('.experience-intro__veil')) return 'veil';
        if (el.matches('[data-experience-sky]')) return 'sky';
        if (el.matches('h1')) return 'title';
        if (el.matches('[data-experience-clock]')) return 'clock';
        if (el.matches('[data-experience-dock]')) return 'dock';
        if (el.matches('.experience-intro__hint')) return 'hint';
        if (el.matches('[data-experience-tilt]')) return 'tilt';
        return 'other';
      });
    });
    expect(order).toEqual(['veil', 'sky', 'title', 'clock', 'dock', 'hint', 'tilt']);

    // v6 dock: empty, decorative and without focus.
    const dock = page.locator('[data-experience-dock]');
    await expect(dock).toHaveCount(1);
    await expect(dock).toHaveAttribute('aria-hidden', 'true');
    expect(await dock.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    expect(await dock.evaluate((el) => el.childElementCount)).toBe(0);
    const dockBox = await dock.evaluate((el) => el.getBoundingClientRect().toJSON());
    expect(Math.abs(dockBox.width - 106)).toBeLessThan(1);
    expect(Math.abs(dockBox.height - 300)).toBeLessThan(1);

    // v5 denied label: <p role="status" hidden>, non-interactive, no controls.
    const label = page.locator('[data-experience-tilt]');
    await expect(label).toHaveCount(1);
    expect(await label.evaluate((el) => el.tagName)).toBe('P');
    await expect(label).toHaveAttribute('role', 'status');
    await expect(label).toBeHidden();
    expect(await label.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    const labelText = (await label.textContent()) ?? '';
    expect(labelText.replace(/\s+/g, ' ').trim()).toContain('Viví la experiencia completa');
    expect(labelText).toContain(
      'Habilitá el acceso a movimiento y orientación en Ajustes › Safari',
    );
    expect(labelText).not.toContain('Sin movimiento');

    const interactive = await page.evaluate(() => {
      const intro = document.querySelector('[data-experience-intro]');
      if (!intro) return { buttons: -1, tabbables: -1, asks: -1 };
      let tabbables = 0;
      for (const node of Array.from(intro.querySelectorAll('[tabindex]'))) {
        if (Number(node.getAttribute('tabindex')) >= 0) tabbables += 1;
      }
      return {
        buttons: intro.querySelectorAll('button').length,
        asks: intro.querySelectorAll('[data-experience-tilt-ask]').length,
        tabbables,
      };
    });
    expect(interactive).toEqual({ buttons: 0, asks: 0, tabbables: 0 });

    // The mask asset is fetched on demand: never preloaded.
    await expect(page.locator('link[rel="preload"][href*="nodo_logo_vector_flat"]')).toHaveCount(0);
  });

  test('dust renders 150 circles in artifact order with cream/stone quotas', async ({ page }) => {
    await page.goto('/');

    const circles = page.locator('[data-experience-sky-dust] circle');
    await expect(circles).toHaveCount(150);

    const stats = await circles.evaluateAll((nodes) => {
      const result = {
        cream: 0,
        stone: 0,
        rMin: Number.POSITIVE_INFINITY,
        rMax: Number.NEGATIVE_INFINITY,
        oMin: Number.POSITIVE_INFINITY,
        oMax: Number.NEGATIVE_INFINITY,
      };
      for (const node of nodes) {
        const radius = Number(node.getAttribute('r'));
        const opacity = Number(node.getAttribute('opacity'));
        if (node.classList.contains('experience-sky__dust-dot--stone')) result.stone += 1;
        else result.cream += 1;
        result.rMin = Math.min(result.rMin, radius);
        result.rMax = Math.max(result.rMax, radius);
        result.oMin = Math.min(result.oMin, opacity);
        result.oMax = Math.max(result.oMax, opacity);
      }
      return result;
    });

    expect(stats.cream).toBe(114);
    expect(stats.stone).toBe(36);
    expect(stats.rMin).toBeGreaterThanOrEqual(0.7);
    expect(stats.rMax).toBeLessThanOrEqual(2);
    expect(stats.oMin).toBeGreaterThanOrEqual(0.1);
    expect(stats.oMax).toBeLessThanOrEqual(0.3);

    const rendered = await circles.evaluateAll((nodes) =>
      nodes.map((node) => ({
        cx: node.getAttribute('cx'),
        cy: node.getAttribute('cy'),
        tone: node.classList.contains('experience-sky__dust-dot--stone') ? 'stone' : 'cream',
      })),
    );
    const dust = readJson<{ points: number[][] }>('src/lib/experience/sky-dust.json');
    expect(rendered).toHaveLength(dust.points.length);
    for (let i = 0; i < rendered.length; i += 1) {
      const point = dust.points[i];
      expect(rendered[i].cx).toBe(`${point[0]}%`);
      expect(rendered[i].cy).toBe(`${point[1]}%`);
    }
  });

  test('sparks render 11 masked nodes with the artifact twinkle flags', async ({ page }) => {
    await page.goto('/');

    const sparks = page.locator('[data-experience-sky-sparks] .experience-sky__spark');
    await expect(sparks).toHaveCount(11);
    expect(
      await sparks.evaluateAll((nodes) =>
        nodes.map((node) => Number(node.getAttribute('data-spark-index'))),
      ),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

    const style = await sparks.first().evaluate((el) => {
      const computed = getComputedStyle(el);
      const halo = getComputedStyle(el, '::before');
      return {
        maskImage: computed.maskImage,
        haloBackground: halo.backgroundImage,
        haloRadius: halo.borderRadius,
        haloPosition: halo.position,
      };
    });
    expect(style.maskImage).toContain('/nodo_logo_vector_flat.svg');
    expect(style.haloBackground).toContain('radial-gradient');
    expect(style.haloRadius).toBe('50%');
    expect(style.haloPosition).toBe('absolute');

    const twinkle = await page.evaluate(() => {
      const entries: Record<string, Record<string, string>> = {};
      for (const node of Array.from(
        document.querySelectorAll('[data-experience-sky-sparks] .experience-sky__spark'),
      )) {
        const computed = getComputedStyle(node);
        entries[node.getAttribute('data-spark-index') ?? ''] = {
          name: computed.animationName,
          duration: computed.animationDuration,
          delay: computed.animationDelay,
          timing: computed.animationTimingFunction,
          direction: computed.animationDirection,
          iterations: computed.animationIterationCount,
        };
      }
      return entries;
    });
    for (const index of [1, 5, 7]) {
      const entry = twinkle[String(index)];
      expect(entry.name, `twinkle #${index}`).not.toBe('none');
      expect(entry.duration, `twinkle #${index}`).toBe('8s');
      expect(entry.timing, `twinkle #${index}`).toBe('cubic-bezier(0.45, 0, 0.55, 1)');
      expect(entry.direction, `twinkle #${index}`).toBe('alternate');
      expect(entry.iterations, `twinkle #${index}`).toBe('infinite');
    }
    for (const index of [2, 3, 4, 6, 8, 9, 10, 11]) {
      expect(twinkle[String(index)].name, `twinkle #${index}`).toBe('none');
    }
    // #5 has twinkleDelaySec: null in the source: CSS default 0s is intentional.
    expect(twinkle['1'].delay).toBe('-2.4s');
    expect(twinkle['5'].delay).toBe('0s');
    expect(twinkle['7'].delay).toBe('-5.1s');
  });

  test('every spark value matches sky-sparks.json (parity)', async ({ page }) => {
    await page.goto('/');
    const file = skySparks();
    const container = page.locator('[data-experience-sky-sparks]');
    const rect = await container.evaluate((el) => el.getBoundingClientRect().toJSON());
    const rendered = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll('[data-experience-sky-sparks] .experience-sky__spark'),
      ).map((node) => {
        const computed = getComputedStyle(node);
        const matrix = new DOMMatrixReadOnly(
          computed.transform === 'none' ? undefined : computed.transform,
        );
        return {
          index: Number(node.getAttribute('data-spark-index')),
          left: Number.parseFloat(computed.left),
          top: Number.parseFloat(computed.top),
          width: Number.parseFloat(computed.width),
          height: Number.parseFloat(computed.height),
          // The twinkle animates `opacity`, so the artifact value is read
          // from the custom property the class materializes.
          opacity: Number.parseFloat(computed.getPropertyValue('--o')),
          background: computed.backgroundColor,
          angle: (Math.atan2(matrix.m12, matrix.m11) * 180) / Math.PI,
          display: computed.display,
        };
      }),
    );

    const toneColor: Record<SkySpark['tone'], string> = {
      gold: 'rgb(201, 167, 67)',
      'gold-soft': 'rgb(228, 199, 122)',
    };
    for (const spark of file.sparks) {
      const node = rendered.find((entry) => entry.index === spark.index);
      expect(node, `spark #${spark.index}`).toBeDefined();
      if (!node) continue;
      expect(Math.abs(node.left - (spark.leftPct / 100) * rect.width)).toBeLessThan(0.5);
      expect(Math.abs(node.top - (spark.topPct / 100) * rect.height)).toBeLessThan(0.5);
      expect(Math.abs(node.width - spark.sizePxDesktop)).toBeLessThan(0.01);
      expect(Math.abs(node.height - spark.sizePxDesktop)).toBeLessThan(0.01);
      expect(Math.abs(node.opacity - spark.opacity)).toBeLessThan(0.001);
      expect(node.background).toBe(toneColor[spark.tone]);
      const angle = ((node.angle + 180) % 360) - 180;
      expect(Math.abs(angle - spark.rotationDeg)).toBeLessThan(0.1);
    }
  });
});

test.describe('sky structure (mobile 390x844)', () => {
  test('hides half the dust and the [3,9,11] sparks, with the #7 override', async ({ browser }) => {
    await withMobile(browser, { width: 390, height: 844 }, null, async (page) => {
      const visibleDots = await page.evaluate(() => {
        let count = 0;
        for (const node of Array.from(
          document.querySelectorAll('[data-experience-sky-dust] circle'),
        )) {
          if (getComputedStyle(node).display !== 'none') count += 1;
        }
        return count;
      });
      expect(visibleDots).toBe(75);

      // Rounded dust: a sample dot's bbox is as wide as it is tall.
      const dot = page.locator('[data-experience-sky-dust] circle').first();
      const dotBox = await dot.evaluate((el) => el.getBoundingClientRect().toJSON());
      expect(Math.abs(dotBox.width - dotBox.height)).toBeLessThan(1);

      // Mobile dock is the smaller frame (54 x 150).
      const dockBox = await page
        .locator('[data-experience-dock]')
        .evaluate((el) => el.getBoundingClientRect().toJSON());
      expect(Math.abs(dockBox.width - 54)).toBeLessThan(1);
      expect(Math.abs(dockBox.height - 150)).toBeLessThan(1);

      // The label never shows without a resolved denial.
      await expect(page.locator('[data-experience-tilt]')).toBeHidden();

      const file = skySparks();
      const container = await page
        .locator('[data-experience-sky-sparks]')
        .evaluate((el) => el.getBoundingClientRect().toJSON());
      const rendered = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll('[data-experience-sky-sparks] .experience-sky__spark'),
        ).map((node) => {
          const computed = getComputedStyle(node);
          return {
            index: Number(node.getAttribute('data-spark-index')),
            left: Number.parseFloat(computed.left),
            top: Number.parseFloat(computed.top),
            width: Number.parseFloat(computed.width),
            display: computed.display,
          };
        }),
      );

      let visible = 0;
      for (const spark of file.sparks) {
        const node = rendered.find((entry) => entry.index === spark.index);
        expect(node, `spark #${spark.index}`).toBeDefined();
        if (!node) continue;
        const expectedLeft = (spark.mobileOverride?.leftPct ?? spark.leftPct) / 100;
        const expectedTop = (spark.mobileOverride?.topPct ?? spark.topPct) / 100;
        if (spark.visibleMobile) {
          visible += 1;
          expect(node.display, `spark #${spark.index} display`).not.toBe('none');
          expect(Math.abs(node.width - spark.sizePxMobile)).toBeLessThan(0.01);
          // Hidden nodes report their specified percentage, so geometry is
          // only meaningful (and only asserted) for visible sparks.
          expect(Math.abs(node.left - expectedLeft * container.width)).toBeLessThan(0.5);
          expect(Math.abs(node.top - expectedTop * container.height)).toBeLessThan(0.5);
        } else {
          expect(node.display, `spark #${spark.index} display`).toBe('none');
        }
      }
      expect(visible).toBe(file.countMobile);
      expect(visible).toBe(8);
    });
  });
});

// --- 2. no-JS / reduced motion ----------------------------------------------

test.describe('degraded modes', () => {
  test('no JS: sky, label, dock, title, clock and film render statically', async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 720 },
    });
    try {
      const page = await context.newPage();
      await page.goto('/');

      await expect(page.locator('[data-experience-sky-dust] circle')).toHaveCount(150);
      await expect(page.locator('[data-experience-sky-sparks] .experience-sky__spark')).toHaveCount(
        11,
      );
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('img[src="/reloj.png"]')).toBeVisible();
      await expect(page.locator('[data-scroll-film]')).toBeVisible();
      await expect(page.locator('[data-experience-tilt]')).toBeHidden();

      for (const selector of ['h1', '[data-experience-clock]']) {
        const opacity = await page
          .locator(selector)
          .first()
          .evaluate((el) => getComputedStyle(el).opacity);
        expect(opacity, selector).toBe('1');
      }

      // No controls of any kind and the clock stays in its base position.
      const interactive = await page.evaluate(() => {
        const intro = document.querySelector('[data-experience-intro]');
        if (!intro) return { buttons: -1, tabbables: -1 };
        let tabbables = 0;
        for (const node of Array.from(intro.querySelectorAll('[tabindex]'))) {
          if (Number(node.getAttribute('tabindex')) >= 0) tabbables += 1;
        }
        return { buttons: intro.querySelectorAll('button').length, tabbables };
      });
      expect(interactive).toEqual({ buttons: 0, tabbables: 0 });
      expect(
        await page
          .locator('[data-experience-clock]')
          .evaluate((el) => getComputedStyle(el).transform),
      ).toBe('none');

      // SSR-only check: the new nodes carry no inline style attributes.
      const styled = await page.evaluate(
        () =>
          document.querySelectorAll(
            '[data-experience-sky][style], [data-experience-sky] [style], ' +
              '[data-experience-tilt][style], [data-experience-tilt] [style], ' +
              '[data-experience-dock][style], [data-experience-dock] [style]',
          ).length,
      );
      expect(styled).toBe(0);
    } finally {
      await context.close();
    }
  });

  test('reduced motion (mobile): never requests, no listeners, label hidden', async ({
    browser,
  }) => {
    await withMobile(
      browser,
      { width: 390, height: 844 },
      { permission: 'granted', reducedMotion: 'reduce' },
      async (page) => {
        expect(
          await page
            .locator('[data-spark-index="1"]')
            .evaluate((el) => getComputedStyle(el).animationName),
        ).toBe('none');
        expect(
          await page
            .locator('[data-spark-index="5"]')
            .evaluate((el) => getComputedStyle(el).animationName),
        ).toBe('none');

        const inline = await page.evaluate(() =>
          [
            '[data-experience-sky]',
            '[data-experience-sky-dust]',
            '[data-experience-sky-sparks]',
          ].map((selector) => document.querySelector(selector)?.getAttribute('style') ?? null),
        );
        for (const value of inline) {
          expect(value ?? '').not.toContain('transform');
          expect(value ?? '').not.toContain('opacity');
        }

        await expect(page.locator('[data-experience-tilt]')).toBeHidden();
        expect(
          await page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls),
        ).toBe(0);

        await dispatchOrientation(page, 120, 40);
        await page.waitForTimeout(300);
        const transform = await page
          .locator('img[src="/reloj.png"]')
          .evaluate((el) => getComputedStyle(el).transform);
        expect(transform).toBe('none');
      },
    );
  });
});

// --- 3. pointer amplitudes (S1) + F2 ----------------------------------------

test('pointer parallax uses the v5 star divisors (S1)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await waitForEntry(page);

  await movePointerAndSettle(page, 0, 0);
  const clock = await readTransform(page, 'img[src="/reloj.png"]');
  expect(Math.abs(clock.m41 - -(1440 / 2) / 15)).toBeLessThan(0.1);
  expect(Math.abs(clock.m42 - -(900 / 2) / 15)).toBeLessThan(0.1);

  const sparks = await readTransform(page, '[data-experience-sky-sparks]');
  expect(Math.abs(sparks.m41 - -(1440 / 2) / 32)).toBeLessThan(0.05);
  expect(Math.abs(sparks.m42 - -(900 / 2) / 32)).toBeLessThan(0.05);
  expect(Math.abs(rotationOf(sparks) - -(1440 / 2) / 2000)).toBeLessThan(0.005);

  const dust = await readTransform(page, '[data-experience-sky-dust]');
  expect(Math.abs(dust.m41 - -(1440 / 2) / 40)).toBeLessThan(0.05);
  expect(Math.abs(dust.m42 - -(900 / 2) / 40)).toBeLessThan(0.05);
  expect(Math.abs(rotationOf(dust) - -(1440 / 2) / 2600)).toBeLessThan(0.005);

  await movePointerAndSettle(page, 1439, 899);
  const opposite = await readTransform(page, '[data-experience-sky-sparks]');
  expect(Math.abs(opposite.m41 - 719 / 32)).toBeLessThan(0.05);
  expect(Math.abs(opposite.m42 - 449 / 32)).toBeLessThan(0.05);
  const oppositeClock = await readTransform(page, 'img[src="/reloj.png"]');
  expect(Math.abs(oppositeClock.m41 - 719 / 15)).toBeLessThan(0.1);
  expect(Math.abs(oppositeClock.m42 - 449 / 15)).toBeLessThan(0.1);

  await movePointerAndSettle(page, 720, 450);
  const centre = await readTransform(page, 'img[src="/reloj.png"]');
  expect(Math.abs(centre.m41)).toBeLessThan(0.05);
  expect(Math.abs(centre.m42)).toBeLessThan(0.05);
  const centreDust = await readTransform(page, '[data-experience-sky-dust]');
  expect(Math.abs(centreDust.m41)).toBeLessThan(0.05);
  expect(Math.abs(centreDust.m42)).toBeLessThan(0.05);
});

test('F2: scrub crossing releases pointer offsets without any input', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await waitForEntry(page);

  await movePointerAndSettle(page, 0, 0);
  expect(Math.abs((await readTransform(page, 'img[src="/reloj.png"]')).m41)).toBeGreaterThan(10);

  // Scroll only (page.evaluate), no pointer events dispatched.
  const progress = await scrollToProgress(page, 0.01);
  expect(progress).toBeGreaterThan(0.003);
  await expect
    .poll(
      async () => {
        const clock = await readTransform(page, 'img[src="/reloj.png"]');
        const starSparks = await readTransform(page, '[data-experience-sky-sparks]');
        const starDust = await readTransform(page, '[data-experience-sky-dust]');
        return Math.max(
          Math.abs(clock.m41),
          Math.abs(clock.m42),
          Math.abs(starSparks.m41),
          Math.abs(rotationOf(starSparks)),
          Math.abs(starDust.m41),
          Math.abs(rotationOf(starDust)),
        );
      },
      { timeout: 8000 },
    )
    .toBeLessThan(0.05);
  const released = await readTransform(page, 'img[src="/reloj.png"]');
  expect(Math.abs(released.m42)).toBeLessThan(0.05);
  const releasedSparks = await readTransform(page, '[data-experience-sky-sparks]');
  expect(Math.abs(releasedSparks.m41)).toBeLessThan(0.05);
  const releasedDust = await readTransform(page, '[data-experience-sky-dust]');
  expect(Math.abs(releasedDust.m41)).toBeLessThan(0.05);

  // Back below the threshold and the offsets return on the next input.
  const back = await scrollToProgress(page, 0);
  expect(back).toBeLessThanOrEqual(0.003);
  await page.mouse.move(100, 100);
  await page.waitForTimeout(1250);
  expect(Math.abs((await readTransform(page, 'img[src="/reloj.png"]')).m41)).toBeGreaterThan(10);
});

test('F2: scrub crossing releases gyro offsets without sensor input', async ({ browser }) => {
  test.setTimeout(90000);
  await withMobile(
    browser,
    { width: 390, height: 844 },
    { permission: 'android' },
    async (page) => {
      await waitForEntry(page);
      await page.waitForTimeout(500);

      await setGyro(page, 1, 1);
      expect(Math.abs((await readTransform(page, 'img[src="/reloj.png"]')).m41)).toBeGreaterThan(
        10,
      );

      const progress = await scrollToProgress(page, 0.01);
      expect(progress).toBeGreaterThan(0.003);
      await expect
        .poll(async () => (await readTransform(page, 'img[src="/reloj.png"]')).m41, {
          timeout: 5000,
        })
        .toBeLessThan(0.5);

      await scrollToProgress(page, 0);
      await dispatchOrientationSeries(page, 120, 37, 30);
      await page.waitForTimeout(1250);
      expect(Math.abs((await readTransform(page, 'img[src="/reloj.png"]')).m41)).toBeGreaterThan(
        10,
      );
    },
  );
});

// --- 4. title exit -----------------------------------------------------------

test('title parts laterally with no fade (E1–E3)', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await waitForEntry(page);

  // E3: the exit is pure translation. The baseline letter-spacing comes from
  // typography.css (-0.035em), so the check is that it never changes.
  const baselineTypography = await page.evaluate(() => {
    const line = document.querySelector('.experience-intro__line');
    if (!line) throw new Error('line missing');
    const computed = getComputedStyle(line);
    return { opacity: computed.opacity, letterSpacing: computed.letterSpacing };
  });
  expect(baselineTypography.opacity).toBe('1');

  for (const target of [0.2, 0.3]) {
    const progress = await scrollToProgress(page, target);
    expect(Math.abs(progress - target)).toBeLessThan(0.01);

    const line1 = await readTransform(page, '.experience-intro__line:nth-child(1)');
    const line2 = await readTransform(page, '.experience-intro__line:nth-child(2)');
    expect(line1.m41, `line 1 at ${target}`).toBeLessThan(0);
    expect(line2.m41, `line 2 at ${target}`).toBeGreaterThan(0);

    const boxes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.experience-intro__line')).map((el) =>
        el.getBoundingClientRect().toJSON(),
      ),
    );
    for (const box of boxes) {
      expect(box.right).toBeGreaterThan(0);
      expect(box.left).toBeLessThan(1440);
    }

    const typography = await page.evaluate(() => {
      const line = document.querySelector('.experience-intro__line');
      if (!line) throw new Error('line missing');
      const computed = getComputedStyle(line);
      return { opacity: computed.opacity, letterSpacing: computed.letterSpacing };
    });
    expect(typography.opacity, `opacity at ${target}`).toBe('1');
    expect(typography.letterSpacing, `letter-spacing at ${target}`).toBe(
      baselineTypography.letterSpacing,
    );
  }

  const progress = await scrollToProgress(page, 0.4);
  expect(Math.abs(progress - 0.4)).toBeLessThan(0.01);
  // Poll: with Lenis active the last sub-pixel settle can trail the scroll
  // event; the cleared state must be reached, not sampled mid-flight.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const line = document.querySelector('.experience-intro__line');
          return line ? line.getBoundingClientRect().right : Number.POSITIVE_INFINITY;
        }),
      { timeout: 5000 },
    )
    .toBeLessThanOrEqual(-8);
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const lines = document.querySelectorAll('.experience-intro__line');
          const line = lines[1];
          return line ? line.getBoundingClientRect().left : Number.NEGATIVE_INFINITY;
        }),
      { timeout: 5000 },
    )
    .toBeGreaterThanOrEqual(1440 + 8);
  const endTypography = await page.evaluate(() => {
    const line = document.querySelector('.experience-intro__line');
    if (!line) throw new Error('line missing');
    const computed = getComputedStyle(line);
    return { opacity: computed.opacity, letterSpacing: computed.letterSpacing };
  });
  expect(endTypography.opacity).toBe('1');
  expect(endTypography.letterSpacing).toBe(baselineTypography.letterSpacing);
});

// --- 5. sky drift + overflow -------------------------------------------------

test('sky drifts inside the intro timeline and the exit never overflows (E5)', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await waitForEntry(page);

  for (const target of [0.2, 0.3, 0.4]) {
    await scrollToProgress(page, target);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      `overflow at ${target}`,
    ).toBeLessThanOrEqual(0);
  }

  await scrollToProgress(page, 0.5);
  const dust = await readTransform(page, '[data-experience-sky-dust]');
  expect(dust.m42).toBeLessThan(0);
  expect(dust.m11).toBeGreaterThan(1);
  expect(dust.m11).toBeLessThanOrEqual(1.025);
  const sparks = await readTransform(page, '[data-experience-sky-sparks]');
  expect(sparks.m42).toBeLessThan(0);

  await scrollToProgress(page, 0.65);
  expect(
    Number(
      await page.locator('[data-experience-sky]').evaluate((el) => getComputedStyle(el).opacity),
    ),
  ).toBe(0);

  await scrollToProgress(page, 0);
  expect(
    Number(
      await page.locator('[data-experience-sky]').evaluate((el) => getComputedStyle(el).opacity),
    ),
  ).toBe(1);
  const dustTop = await readTransform(page, '[data-experience-sky-dust]');
  expect(Math.abs(dustTop.m42)).toBeLessThan(0.5);
  expect(Math.abs(dustTop.m11 - 1)).toBeLessThan(0.001);
});

// --- 6. permission pipeline + gyro -------------------------------------------

test('G2/G7 granted: automatic load attempt, arming after entry, S2 star budget', async ({
  browser,
}) => {
  test.setTimeout(90000);
  await withMobile(
    browser,
    { width: 390, height: 844 },
    { permission: 'granted', extra: listenerSpyInit },
    async (page) => {
      // G2: exactly one load attempt without any interaction.
      await expect
        .poll(
          async () =>
            page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls ?? 0),
          { timeout: 10000 },
        )
        .toBe(1);

      // No interactive control anywhere.
      const interactive = await page.evaluate(() => {
        const intro = document.querySelector('[data-experience-intro]');
        if (!intro) return { buttons: -1, tabbables: -1, asks: -1 };
        let tabbables = 0;
        for (const node of Array.from(intro.querySelectorAll('[tabindex]'))) {
          if (Number(node.getAttribute('tabindex')) >= 0) tabbables += 1;
        }
        return {
          buttons: intro.querySelectorAll('button').length,
          asks: intro.querySelectorAll('[data-experience-tilt-ask]').length,
          tabbables,
        };
      });
      expect(interactive).toEqual({ buttons: 0, asks: 0, tabbables: 0 });
      await expect(page.locator('[data-experience-tilt]')).toBeHidden();

      // G7 (v7): the granted path attaches the single listener as soon as the
      // grant resolves, but samples only move the clock once the entry has
      // completed (pre-entry samples never move nor baseline).
      expect(
        await page.evaluate(
          () =>
            ((window as unknown as TestWindow).__listenerCounts ?? {})['deviceorientation'] ?? 0,
        ),
      ).toBe(1);
      await dispatchOrientationSeries(page, 95, 12, 8);
      await dispatchOrientationSeries(page, 120, 37, 30);
      const beforeEntry = await page
        .locator('img[src="/reloj.png"]')
        .evaluate((el) => getComputedStyle(el).transform);
      expect(beforeEntry).toBe('none');

      await waitForEntry(page);
      expect(
        await page.evaluate(
          () =>
            ((window as unknown as TestWindow).__listenerCounts ?? {})['deviceorientation'] ?? 0,
        ),
      ).toBe(1);
      await setGyro(page, 1, 1);

      // Clock budget unchanged, stars at 48 % / 36 % (v5 S2).
      const clock = await readTransform(page, 'img[src="/reloj.png"]');
      expect(Math.abs(clock.m41 - 24)).toBeLessThan(0.2);
      expect(Math.abs(clock.m42 - 14)).toBeLessThan(0.2);
      const sparks = await readTransform(page, '[data-experience-sky-sparks]');
      expect(Math.abs(sparks.m41 - 0.48 * 24)).toBeLessThan(0.05);
      expect(Math.abs(rotationOf(sparks) - 0.45)).toBeLessThan(0.01);
      const dust = await readTransform(page, '[data-experience-sky-dust]');
      expect(Math.abs(dust.m41 - 0.36 * 24)).toBeLessThan(0.05);
      expect(Math.abs(rotationOf(dust) - 0.34)).toBeLessThan(0.01);

      // Deadzone: back to the baseline posture, offsets settle at 0.
      await dispatchOrientationSeries(page, 95, 12, 30);
      await page.waitForTimeout(1250);
      const rest = await readTransform(page, 'img[src="/reloj.png"]');
      expect(Math.abs(rest.m41)).toBeLessThan(1);
      expect(Math.abs(rest.m42)).toBeLessThan(1);
    },
  );
});

test('G3′ non-final (prompt): non-activation events never consume; activation re-arms to the cap', async ({
  browser,
}) => {
  test.setTimeout(120000);
  await withMobile(
    browser,
    { width: 390, height: 844 },
    { permission: 'prompt', extra: listenerSpyInit },
    async (page) => {
      const calls = () =>
        page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls ?? 0);
      await expect.poll(calls, { timeout: 10000 }).toBe(1);
      const label = page.locator('[data-experience-tilt]');
      await expect(label).toBeHidden();

      // RC-1 negatives: touchstart/wheel/scroll and a touch pointerdown do not
      // consume the retry (they are not activation-qualifying).
      await dispatchGesture(page, 'touchstart');
      await dispatchGesture(page, 'wheel');
      await dispatchGesture(page, 'scroll');
      await dispatchGesture(page, 'pointerdown', 'touch');
      await page.waitForTimeout(250);
      expect(await calls()).toBe(1);
      await expect(label).toBeHidden();

      // Four activation interactions + the load attempt = the 5-attempt cap.
      for (let expected = 2; expected <= 5; expected += 1) {
        await dispatchGesture(page, 'click');
        await expect.poll(calls, { timeout: 5000 }).toBe(expected);
      }
      await expect(label).toBeHidden();
      expect(await label.textContent()).not.toContain('Sin movimiento');
      // The retry listeners self-removed on each interaction.
      const removals = await page.evaluate(
        () => (window as unknown as TestWindow).__listenerRemovals ?? {},
      );
      expect(removals['click'] ?? 0).toBeGreaterThanOrEqual(4);

      // After the cap: no further calls, no label, no silent UI.
      await dispatchGesture(page, 'click');
      await page.waitForTimeout(300);
      expect(await calls()).toBe(5);
      await expect(label).toBeHidden();
    },
  );
});

test('G3′ non-final rejection (NotAllowedError): retryable, never terminal, no label', async ({
  browser,
}) => {
  test.setTimeout(90000);
  await withMobile(browser, { width: 390, height: 844 }, { permission: 'reject' }, async (page) => {
    const calls = () =>
      page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls ?? 0);
    await expect.poll(calls, { timeout: 10000 }).toBe(1);
    const label = page.locator('[data-experience-tilt]');
    await expect(label).toBeHidden();

    // Each activation interaction re-attempts; non-final results never end
    // the pipeline below the cap and never show UI.
    await dispatchGesture(page, 'keydown');
    await expect.poll(calls, { timeout: 5000 }).toBe(2);
    await expect(label).toBeHidden();
    await dispatchGesture(page, 'touchend');
    await expect.poll(calls, { timeout: 5000 }).toBe(3);
    await expect(label).toBeHidden();
    expect(await label.textContent()).not.toContain('Sin movimiento');
  });
});

test('G5 denied: label shown after entry with exact copy, no re-prompt', async ({ browser }) => {
  test.setTimeout(90000);
  await withMobile(browser, { width: 390, height: 844 }, { permission: 'denied' }, async (page) => {
    await expect
      .poll(
        async () =>
          page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls ?? 0),
        { timeout: 10000 },
      )
      .toBe(1);

    await waitForEntry(page);
    const label = page.locator('[data-experience-tilt]');
    await expect(label).toBeVisible();
    await expect(label).toHaveAttribute('role', 'status');
    expect(await label.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    const text = ((await label.textContent()) ?? '').replace(/\s+/g, ' ').trim();
    expect(text).toContain('Viví la experiencia completa');
    expect(text).toContain('Habilitá el acceso a movimiento y orientación en Ajustes › Safari');
    expect(text).not.toContain('Sin movimiento');
    await expect(page.locator('[data-experience-tilt-ask]')).toHaveCount(0);

    // No sensor listener: full stimulus produces no transform.
    await dispatchOrientationSeries(page, 95, 12, 8);
    await dispatchOrientationSeries(page, 120, 37, 30);
    await page.waitForTimeout(1250);
    const clock = await readTransform(page, 'img[src="/reloj.png"]');
    expect(Math.abs(clock.m41)).toBeLessThan(0.5);
    expect(Math.abs(clock.m42)).toBeLessThan(0.5);

    // Later gestures never call again nor change the label.
    await dispatchGesture(page, 'pointerdown');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls)).toBe(
      1,
    );
    await expect(label).toBeVisible();

    // D15: the label retires with the hint at 0-8 %.
    await scrollToProgress(page, 0.1);
    expect(Number(await label.evaluate((el) => getComputedStyle(el).opacity))).toBe(0);
  });
});

test('G4/G5 denied via the activation retry shows the label', async ({ browser }) => {
  test.setTimeout(90000);
  await withMobile(
    browser,
    { width: 390, height: 844 },
    { permission: 'prompt-then-denied' },
    async (page) => {
      const calls = () =>
        page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls ?? 0);
      await expect.poll(calls, { timeout: 10000 }).toBe(1);
      await waitForEntry(page);
      const label = page.locator('[data-experience-tilt]');
      await expect(label).toBeHidden();

      await dispatchGesture(page, 'click');
      await expect(label).toBeVisible();
      await expect.poll(calls, { timeout: 5000 }).toBe(2);
      const text = ((await label.textContent()) ?? '').replace(/\s+/g, ' ').trim();
      expect(text).toContain('Viví la experiencia completa');
      expect(text).toContain('Habilitá el acceso a movimiento y orientación en Ajustes › Safari');

      await dispatchGesture(page, 'click');
      await page.waitForTimeout(300);
      expect(await calls()).toBe(2);
      await expect(label).toBeVisible();
    },
  );
});

test('Android (no requestPermission): auto-start, no UI, no calls', async ({ browser }) => {
  await withMobile(
    browser,
    { width: 390, height: 844 },
    { permission: 'android' },
    async (page) => {
      await waitForEntry(page);
      await expect(page.locator('[data-experience-tilt]')).toBeHidden();
      expect(
        await page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls),
      ).toBe(0);
      await page.waitForTimeout(500);

      await setGyro(page, 1, 1);
      const clock = await readTransform(page, 'img[src="/reloj.png"]');
      expect(clock.m41).toBeGreaterThan(22);
      expect(clock.m41).toBeLessThanOrEqual(24.2);
      expect(clock.m42).toBeGreaterThan(13);
    },
  );
});

test('unsupported (no DeviceOrientationEvent): no calls, no label, no motion', async ({
  browser,
}) => {
  await withMobile(
    browser,
    { width: 390, height: 844 },
    { permission: 'unsupported' },
    async (page) => {
      await waitForEntry(page);
      await expect(page.locator('[data-experience-tilt]')).toBeHidden();
      expect(
        await page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls),
      ).toBe(0);
    },
  );
});

test('gyro respects screen orientation compensation (cos/sin)', async ({ browser }) => {
  await withMobile(
    browser,
    { width: 390, height: 844 },
    { permission: 'android' },
    async (page) => {
      await waitForEntry(page);
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        Object.defineProperty(screen.orientation, 'angle', { configurable: true, get: () => 90 });
      });

      // Baseline (8) then a pure horizontal delta (+25 in gamma): with angle 90
      // the compensation maps it entirely to the y axis.
      await dispatchOrientationSeries(page, 95, 12, 8);
      await dispatchOrientationSeries(page, 95, 37, 30);
      await page.waitForTimeout(1250);

      const clock = await readTransform(page, 'img[src="/reloj.png"]');
      expect(Math.abs(clock.m41)).toBeLessThan(1);
      expect(clock.m42).toBeLessThan(-13);
      expect(clock.m42).toBeGreaterThanOrEqual(-14.2);
    },
  );
});

// --- 7. gating + listener budget ---------------------------------------------

test('G9 desktop: no request, no listener, no label, deviceorientation ignored', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  try {
    await context.addInitScript(() => {
      const testWindow = window as unknown as TestWindow;
      testWindow.__tiltPermissionCalls = 0;
      const ctor = DeviceOrientationEvent as unknown as Record<string, unknown>;
      ctor.requestPermission = () => {
        testWindow.__tiltPermissionCalls = (testWindow.__tiltPermissionCalls ?? 0) + 1;
        return Promise.resolve('denied');
      };
      testWindow.__listenerCounts = {};
      const originalAdd = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (
        this: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ) {
        const counts = testWindow.__listenerCounts ?? {};
        counts[type] = (counts[type] ?? 0) + 1;
        testWindow.__listenerCounts = counts;
        return originalAdd.call(this, type, listener, options);
      };
    });
    const page = await context.newPage();
    await page.goto('/');
    await waitForEntry(page);

    await dispatchOrientation(page, 120, 40);
    await page.waitForTimeout(400);
    const transform = await page
      .locator('img[src="/reloj.png"]')
      .evaluate((el) => getComputedStyle(el).transform);
    expect(transform).toBe('none');
    await expect(page.locator('[data-experience-tilt]')).toBeHidden();

    const counts = await page.evaluate(
      () => (window as unknown as TestWindow).__listenerCounts ?? {},
    );
    expect(await page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls)).toBe(
      0,
    );
    expect(counts['deviceorientation'] ?? 0).toBe(0);
    expect(counts['pointermove'] ?? 0).toBeLessThanOrEqual(1);
  } finally {
    await context.close();
  }
});

test('G10/G12 listener invariant: one deviceorientation add per lifetime; retry self-removes', async ({
  browser,
}) => {
  test.setTimeout(150000);
  const viewport = { width: 390, height: 844 };

  // Android `auto`: the listener is attached at init and stays unique through
  // entry + samples; the other families stay within the budget.
  await withMobile(
    browser,
    viewport,
    { permission: 'android', extra: listenerSpyInit },
    async (page) => {
      const adds = () =>
        page.evaluate(
          () =>
            ((window as unknown as TestWindow).__listenerCounts ?? {})['deviceorientation'] ?? 0,
        );
      await expect.poll(adds, { timeout: 10000 }).toBe(1);
      await waitForEntry(page);
      await page.waitForTimeout(500);
      await dispatchOrientationSeries(page, 95, 12, 8);
      await dispatchOrientationSeries(page, 120, 37, 5);
      await page.waitForTimeout(300);
      expect(await adds()).toBe(1);

      const counts = await page.evaluate(
        () => (window as unknown as TestWindow).__listenerCounts ?? {},
      );
      // ScrollTrigger registers one `visibilitychange` listener itself.
      expect(counts['visibilitychange'] ?? 0).toBeLessThanOrEqual(2);
      expect(counts['orientationchange'] ?? 0).toBe(1);
      expect(counts['pointermove'] ?? 0).toBeLessThanOrEqual(1);

      // Off-screen pause: scrolling past the intro zeroes the offsets.
      await setGyro(page, 1, 1);
      expect(Math.abs((await readTransform(page, 'img[src="/reloj.png"]')).m41)).toBeGreaterThan(
        10,
      );
      await scrollToProgress(page, 1);
      await page.waitForTimeout(300);
      await dispatchOrientationSeries(page, 120, 37, 5);
      await page.waitForTimeout(1250);
      expect(Math.abs((await readTransform(page, 'img[src="/reloj.png"]')).m41)).toBeLessThan(2);
    },
  );

  // Non-final path: the retry arms the activation listeners, they self-remove
  // on use, and the optimistic attach adds exactly one motion listener.
  await withMobile(
    browser,
    viewport,
    { permission: 'prompt', extra: listenerSpyInit },
    async (page) => {
      const calls = () =>
        page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls ?? 0);
      await expect.poll(calls, { timeout: 10000 }).toBe(1);
      const counts = await page.evaluate(
        () => (window as unknown as TestWindow).__listenerCounts ?? {},
      );
      for (const type of RETRY_EVENTS) {
        expect(counts[type] ?? 0, `armed ${type}`).toBeGreaterThanOrEqual(1);
      }
      expect(counts['deviceorientation'] ?? 0).toBe(1); // optimistic attach

      await dispatchGesture(page, 'click');
      await expect.poll(calls, { timeout: 5000 }).toBe(2);
      const removals = await page.evaluate(
        () => (window as unknown as TestWindow).__listenerRemovals ?? {},
      );
      for (const type of RETRY_EVENTS) {
        expect(removals[type] ?? 0, `removed ${type}`).toBeGreaterThanOrEqual(1);
      }
      const countsAfter = await page.evaluate(
        () => (window as unknown as TestWindow).__listenerCounts ?? {},
      );
      expect(countsAfter['deviceorientation'] ?? 0).toBe(1);
    },
  );
});

// --- 8. v7 permission policy (RC-1/RC-2/G10/G11) -----------------------------

test('@webkit isActivationQualifyingEvent matrix (Node predicate)', () => {
  for (const type of ['touchend', 'pointerup', 'click', 'mousedown', 'keydown']) {
    expect(isActivationQualifyingEvent(type), type).toBe(true);
  }
  expect(isActivationQualifyingEvent('pointerdown', 'mouse')).toBe(true);
  expect(isActivationQualifyingEvent('pointerdown', 'touch')).toBe(false);
  expect(isActivationQualifyingEvent('pointerdown')).toBe(false);
  for (const type of [...NON_ACTIVATION_EVENTS, 'pointermove', 'mouseup']) {
    expect(isActivationQualifyingEvent(type), type).toBe(false);
  }
});

test('@webkit RC-1: activation events call once; non-activation events call none', async ({
  browser,
}) => {
  test.setTimeout(240000);
  await withMobile(browser, { width: 390, height: 844 }, { permission: 'prompt' }, async (page) => {
    const calls = () =>
      page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls ?? 0);

    const positives: Array<{ type: string; pointerType?: string }> = [
      { type: 'touchend' },
      { type: 'pointerup' },
      { type: 'click' },
      { type: 'mousedown' },
      { type: 'keydown' },
      { type: 'pointerdown', pointerType: 'mouse' },
    ];
    for (const entry of positives) {
      await page.goto('/');
      await expect.poll(calls, { timeout: 10000 }).toBe(1);
      await dispatchGesture(page, entry.type, entry.pointerType);
      await expect.poll(calls, { timeout: 5000 }).toBe(2);
    }

    const negatives: Array<{ type: string; pointerType?: string }> = [
      { type: 'touchstart' },
      { type: 'wheel' },
      { type: 'scroll' },
      { type: 'pointerdown', pointerType: 'touch' },
    ];
    for (const entry of negatives) {
      await page.goto('/');
      await expect.poll(calls, { timeout: 10000 }).toBe(1);
      await dispatchGesture(page, entry.type, entry.pointerType);
      await page.waitForTimeout(300);
      expect(await calls(), `no call for ${entry.type}`).toBe(1);
    }
    // The negatives did not consume the retry of the last context.
    await dispatchGesture(page, 'click');
    await expect.poll(calls, { timeout: 5000 }).toBe(2);
  });
});

test('G3′/RC-2 repeated prompt: 5-attempt cap, no label, optimistic motion', async ({
  browser,
}) => {
  test.setTimeout(150000);
  await withMobile(
    browser,
    { width: 390, height: 844 },
    { permission: 'prompt', extra: listenerSpyInit },
    async (page) => {
      const calls = () =>
        page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls ?? 0);
      const adds = () =>
        page.evaluate(
          () =>
            ((window as unknown as TestWindow).__listenerCounts ?? {})['deviceorientation'] ?? 0,
        );
      const label = page.locator('[data-experience-tilt]');

      await expect.poll(calls, { timeout: 10000 }).toBe(1);
      await expect(label).toBeHidden();
      // RC-2: the first non-final result attaches the single motion listener.
      await expect.poll(adds, { timeout: 5000 }).toBe(1);

      // Load attempt + four activation interactions = 5 calls, never terminal.
      for (let expected = 2; expected <= 5; expected += 1) {
        await dispatchGesture(page, 'click');
        await expect.poll(calls, { timeout: 5000 }).toBe(expected);
        await expect(label).toBeHidden();
      }

      // Cap reached: no more calls, no label, no silent UI.
      await dispatchGesture(page, 'click');
      await page.waitForTimeout(300);
      expect(await calls()).toBe(5);
      await expect(label).toBeHidden();
      expect(await adds()).toBe(1);

      // The optimistic listener still delivers motion after the entry.
      await waitForEntry(page);
      await setGyro(page, 1, 1);
      expect(Math.abs((await readTransform(page, 'img[src="/reloj.png"]')).m41)).toBeGreaterThan(
        10,
      );
      await expect(label).toBeHidden();
    },
  );
});

test('G10 optimistic attach: motion without a resolved grant; denied tears down + label', async ({
  browser,
}) => {
  test.setTimeout(150000);
  await withMobile(
    browser,
    { width: 390, height: 844 },
    { permission: 'prompt-then-denied', extra: listenerSpyInit },
    async (page) => {
      const calls = () =>
        page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls ?? 0);
      const removals = (type: string) =>
        page.evaluate(
          (t) => ((window as unknown as TestWindow).__listenerRemovals ?? {})[t] ?? 0,
          type,
        );
      const label = page.locator('[data-experience-tilt]');

      await expect.poll(calls, { timeout: 10000 }).toBe(1);
      // Optimistic attach after the first non-final result.
      await expect
        .poll(
          async () =>
            page.evaluate(
              () =>
                ((window as unknown as TestWindow).__listenerCounts ?? {})['deviceorientation'] ??
                0,
            ),
          { timeout: 5000 },
        )
        .toBe(1);

      // Pre-entry samples: no movement, no baseline, no label, no extra call.
      await dispatchOrientationSeries(page, 95, 12, 8);
      await dispatchOrientationSeries(page, 120, 37, 30);
      expect(
        await page
          .locator('img[src="/reloj.png"]')
          .evaluate((el) => getComputedStyle(el).transform),
      ).toBe('none');
      await expect(label).toBeHidden();
      expect(await calls()).toBe(1);

      // After the entry the finite samples move the clock without a grant.
      await waitForEntry(page);
      await setGyro(page, 1, 1);
      expect(Math.abs((await readTransform(page, 'img[src="/reloj.png"]')).m41)).toBeGreaterThan(
        10,
      );
      expect(await calls()).toBe(1);
      await expect(label).toBeHidden();

      // A later `denied` tears the listener down, zeroes the offsets and shows
      // the label (only reachable through an activation interaction).
      await dispatchGesture(page, 'click');
      await expect.poll(calls, { timeout: 5000 }).toBe(2);
      await expect(label).toBeVisible();
      await expect
        .poll(() => removals('deviceorientation'), { timeout: 5000 })
        .toBeGreaterThanOrEqual(1);
      await expect
        .poll(async () => Math.abs((await readTransform(page, 'img[src="/reloj.png"]')).m41), {
          timeout: 5000,
        })
        .toBeLessThan(0.5);

      // Terminal: later interactions never call again nor change the label.
      await dispatchGesture(page, 'click');
      await page.waitForTimeout(300);
      expect(await calls()).toBe(2);
      await expect(label).toBeVisible();
    },
  );
});

test('G10 optimistic + granted keeps the single listener (G7)', async ({ browser }) => {
  test.setTimeout(90000);
  await withMobile(
    browser,
    { width: 390, height: 844 },
    { permission: 'prompt-then-granted', extra: listenerSpyInit },
    async (page) => {
      const calls = () =>
        page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls ?? 0);
      const adds = () =>
        page.evaluate(
          () =>
            ((window as unknown as TestWindow).__listenerCounts ?? {})['deviceorientation'] ?? 0,
        );
      await expect.poll(calls, { timeout: 10000 }).toBe(1);
      expect(await adds()).toBe(1);

      await dispatchGesture(page, 'click');
      await expect.poll(calls, { timeout: 5000 }).toBe(2);
      expect(await adds()).toBe(1); // the same listener, no duplicates
      expect(
        await page.evaluate(
          () =>
            ((window as unknown as TestWindow).__listenerRemovals ?? {})['deviceorientation'] ?? 0,
        ),
      ).toBe(0);

      await waitForEntry(page);
      await setGyro(page, 1, 1);
      expect(Math.abs((await readTransform(page, 'img[src="/reloj.png"]')).m41)).toBeGreaterThan(
        10,
      );
      await expect(page.locator('[data-experience-tilt]')).toBeHidden();
    },
  );
});

test('G11 short-side gate: a landscape phone runs the pipeline; large tablets stay out', async ({
  browser,
}) => {
  test.setTimeout(150000);

  // 844×390 phone in landscape: short side 390 <= 800 -> pipeline runs.
  await withMobile(
    browser,
    { width: 844, height: 390 },
    { permission: 'granted' },
    async (page) => {
      const calls = () =>
        page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls ?? 0);
      await expect.poll(calls, { timeout: 10000 }).toBe(1);
      await waitForEntry(page);
      await setGyro(page, 1, 1);
      expect(Math.abs((await readTransform(page, 'img[src="/reloj.png"]')).m41)).toBeGreaterThan(
        10,
      );
    },
  );

  // Large tablets (iPad Pro 11" / iPad 10.9"): short side > 800 -> excluded.
  for (const viewport of [
    { width: 834, height: 1194 },
    { width: 820, height: 1180 },
  ]) {
    await withMobile(browser, viewport, { permission: 'granted' }, async (page) => {
      const calls = () =>
        page.evaluate(() => (window as unknown as TestWindow).__tiltPermissionCalls ?? 0);
      await page.waitForTimeout(1200);
      expect(await calls(), `${viewport.width}x${viewport.height} requests`).toBe(0);
      await expect(page.locator('[data-experience-tilt]')).toBeHidden();
      await dispatchOrientationSeries(page, 95, 12, 8);
      await dispatchOrientationSeries(page, 120, 37, 30);
      expect(
        await page
          .locator('img[src="/reloj.png"]')
          .evaluate((el) => getComputedStyle(el).transform),
        `${viewport.width}x${viewport.height} motion`,
      ).toBe('none');
    });
  }
});

// --- 9. continuity intro -> film (C1/C2) -------------------------------------

test('C1: film backdrop and veil compute the same stack; overlay off without video', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await scrollToProgress(page, 0.5);

  const stacks = await page.evaluate(() => {
    const veil = document.querySelector('.experience-intro__veil');
    const film = document.querySelector('.scroll-film__viewport');
    const overlay = document.querySelector('.scroll-film__overlay');
    const section = document.querySelector('[data-scroll-film]');
    if (!veil || !film || !overlay) throw new Error('continuity nodes missing');
    const veilStyle = getComputedStyle(veil);
    const filmStyle = getComputedStyle(film);
    return {
      veilImage: veilStyle.backgroundImage,
      veilColor: veilStyle.backgroundColor,
      filmImage: filmStyle.backgroundImage,
      filmColor: filmStyle.backgroundColor,
      filmOpacity: filmStyle.opacity,
      filmTransform: filmStyle.transform,
      overlayOpacity: getComputedStyle(overlay).opacity,
      videoReady: section?.hasAttribute('data-video-ready') ?? true,
    };
  });

  expect(stacks.filmImage).toBe(stacks.veilImage);
  expect(stacks.filmColor).toBe(stacks.veilColor);
  expect(stacks.filmOpacity).toBe('1');
  expect(stacks.filmTransform).toBe('none');
  expect(stacks.overlayOpacity).toBe('0');
  expect(stacks.videoReady).toBe(false);
});

const CONTINUITY_VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1440, height: 700 },
  { width: 1280, height: 650 },
  { width: 390, height: 844 },
];

for (const viewport of CONTINUITY_VIEWPORTS) {
  test(`C2 continuity pixel sampling ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    test.setTimeout(120000);
    await withDesktop(browser, viewport, async (page) => {
      const x = Math.max(2, Math.round(viewport.width * 0.01));

      // The film panel rises from below, so the sample point sits just inside
      // it at t 0.50 (the highest film top among the sampled states where the
      // veil is already translucent); at 0.34 the veil is still opaque and at
      // 0.66 the panel covers more. This is the "design point": one fixed
      // screen point that stays over the film through the reveal.
      await scrollToProgress(page, 0.5);
      const filmTop = await page.evaluate(() => {
        const film = document.querySelector('.scroll-film__viewport');
        if (!film) throw new Error('film viewport missing');
        return film.getBoundingClientRect().top;
      });
      const y = Math.min(viewport.height - 4, Math.max(4, Math.round(filmTop) + 50));

      // Reference: the veil at rest (fully opaque) at the same screen point.
      await scrollToProgress(page, 0);
      const reference = await samplePixel(page, x, y);
      expect(reference.r).toBeGreaterThan(0);

      for (const target of [0.34, 0.5, 0.66]) {
        await scrollToProgress(page, target);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
          `overflow at ${target}`,
        ).toBeLessThanOrEqual(0);
        const sample = await samplePixel(page, x, y);
        const delta = channelDelta(sample, reference);
        console.log(
          `CONTINUITY ${viewport.width}x${viewport.height} t=${target} ` +
            `rgb(${sample.r},${sample.g},${sample.b}) ref(${reference.r},${reference.g},${reference.b}) delta=${delta}`,
        );
        expect(delta, `delta at ${target}`).toBeLessThanOrEqual(2);
      }
    });
  });
}

// --- 10. dock + landing (C3/C4/C6) -------------------------------------------

test('C6 dock is decorative and the landing never overflows', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await waitForEntry(page);

  const dock = page.locator('[data-experience-dock]');
  await expect(dock).toHaveAttribute('aria-hidden', 'true');
  expect(await dock.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  expect(await dock.evaluate((el) => el.childElementCount)).toBe(0);

  for (const target of [0.55, 0.75, 0.85, 1]) {
    await scrollToProgress(page, target);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      `overflow at ${target}`,
    ).toBeLessThanOrEqual(0);
  }
});

for (const viewport of [
  { width: 1440, height: 900, scale: 0.32 },
  { width: 1280, height: 650, scale: 0.32 },
]) {
  test(`C3/C4 landing desktop ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    test.setTimeout(120000);
    await withDesktop(browser, viewport, async (page) => {
      await waitForEntry(page);

      const samples: LandingProbe[] = [];
      for (const target of [0.55, 0.65, 0.75, 0.85, 1]) {
        await scrollToProgress(page, target);
        samples.push(await readLanding(page));
      }

      // Monotonic convergence: the clock shrinks and travels down to the dock.
      for (let i = 1; i < samples.length; i += 1) {
        expect(samples[i].scale, `scale monotonic at index ${i}`).toBeLessThanOrEqual(
          samples[i - 1].scale + 0.01,
        );
        expect(samples[i].clockCenter.y, `center monotonic at index ${i}`).toBeGreaterThanOrEqual(
          samples[i - 1].clockCenter.y - 1,
        );
      }

      const settled = samples.slice(-2);
      for (const probe of settled) {
        const dockCenter = {
          x: (probe.dock.left + probe.dock.right) / 2,
          y: (probe.dock.top + probe.dock.bottom) / 2,
        };
        expect(Math.abs(probe.clockCenter.x - dockCenter.x)).toBeLessThan(2);
        expect(Math.abs(probe.clockCenter.y - dockCenter.y)).toBeLessThan(2);
        expect(Math.abs(probe.scale - viewport.scale)).toBeLessThan(0.005);
        const expectedHeight = 0.5407 * probe.clockWidth * viewport.scale;
        expect(Math.abs(probe.clockVisibleHeight - expectedHeight)).toBeLessThan(5);
        expect(probe.opacity).toBe('1');
        expect(probe.filter).toBe('none');
        expect(probe.wrapperStyle).not.toContain('filter');
      }
    });
  });
}

for (const viewport of [
  { width: 390, height: 844, scale: 0.3 },
  { width: 360, height: 640, scale: 0.3 },
]) {
  test(`C3/C4 landing mobile ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    test.setTimeout(120000);
    await withMobile(browser, viewport, { permission: 'android' }, async (page) => {
      await waitForEntry(page);
      await page.waitForTimeout(400);

      const samples: LandingProbe[] = [];
      for (const target of [0.55, 0.65, 0.75, 0.85, 1]) {
        await scrollToProgress(page, target);
        samples.push(await readLanding(page));
      }

      for (let i = 1; i < samples.length; i += 1) {
        expect(samples[i].scale, `scale monotonic at index ${i}`).toBeLessThanOrEqual(
          samples[i - 1].scale + 0.01,
        );
        expect(samples[i].clockCenter.y, `center monotonic at index ${i}`).toBeGreaterThanOrEqual(
          samples[i - 1].clockCenter.y - 1,
        );
      }

      const settled = samples.slice(-2);
      for (const probe of settled) {
        const dockCenter = {
          x: (probe.dock.left + probe.dock.right) / 2,
          y: (probe.dock.top + probe.dock.bottom) / 2,
        };
        expect(Math.abs(probe.clockCenter.x - dockCenter.x)).toBeLessThan(2);
        expect(Math.abs(probe.clockCenter.y - dockCenter.y)).toBeLessThan(2);
        expect(Math.abs(probe.scale - viewport.scale)).toBeLessThan(0.005);
        const expectedHeight = 0.5407 * probe.clockWidth * viewport.scale;
        expect(Math.abs(probe.clockVisibleHeight - expectedHeight)).toBeLessThan(5);
        expect(probe.opacity).toBe('1');
        expect(probe.filter).toBe('none');
      }
    });
  });
}

// --- 11. no-occlusion contract (G8/E4) ---------------------------------------

const DESKTOP_VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1440, height: 700 },
  { width: 1280, height: 650 },
  { width: 1920, height: 1080 },
];

const MOBILE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
];

const SCRUB_STATES = [0, 0.05, 0.1, 0.15, 0.2, 0.275, 0.35, 0.4, 0.5, 0.65, 0.75, 0.85, 1];

for (const viewport of DESKTOP_VIEWPORTS) {
  test(`no-occlusion desktop ${viewport.width}x${viewport.height} (scrub + landing + pointer)`, async ({
    browser,
  }) => {
    test.setTimeout(180000);
    await withDesktop(browser, viewport, async (page) => {
      await waitForEntry(page);
      let worstBox = Number.POSITIVE_INFINITY;
      let worstInk = Number.POSITIVE_INFINITY;

      for (const target of SCRUB_STATES) {
        await scrollToProgress(page, target);
        if (target >= 0.55) {
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
            `overflow at ${target}`,
          ).toBeLessThanOrEqual(0);
        }
        const clearance = await measureClearance(page);
        worstBox = Math.min(worstBox, clearance.boxGap);
        worstInk = Math.min(worstInk, clearance.inkGap);
        if (clearance.measuredLines > 0) {
          expect(clearance.boxGap, `box at ${target}`).toBeGreaterThanOrEqual(-0.5);
          expect(clearance.inkGap, `ink at ${target}`).toBeGreaterThanOrEqual(7.5);
        }
      }

      await scrollToProgress(page, 0);
      const corners = [
        { x: viewport.width / 2, y: viewport.height / 2 },
        { x: 0, y: 0 },
        { x: viewport.width - 1, y: 0 },
        { x: 0, y: viewport.height - 1 },
        { x: viewport.width - 1, y: viewport.height - 1 },
      ];
      for (const corner of corners) {
        await movePointerAndSettle(page, corner.x, corner.y);
        const clearance = await measureClearance(page);
        worstBox = Math.min(worstBox, clearance.boxGap);
        worstInk = Math.min(worstInk, clearance.inkGap);
        expect(clearance.boxGap, `box at pointer ${corner.x},${corner.y}`).toBeGreaterThanOrEqual(
          -0.5,
        );
        expect(clearance.inkGap, `ink at pointer ${corner.x},${corner.y}`).toBeGreaterThanOrEqual(
          7.5,
        );
      }

      console.log(
        `NO_OCCLUSION desktop ${viewport.width}x${viewport.height} ` +
          `worstBox=${worstBox.toFixed(2)} worstInk=${worstInk.toFixed(2)}`,
      );
    });
  });
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`no-occlusion mobile ${viewport.width}x${viewport.height} (scrub + landing + gyro extremes)`, async ({
    browser,
  }) => {
    test.setTimeout(180000);
    await withMobile(browser, viewport, { permission: 'android' }, async (page) => {
      await waitForEntry(page);
      await page.waitForTimeout(500);
      let worstBox = Number.POSITIVE_INFINITY;
      let worstInk = Number.POSITIVE_INFINITY;

      for (const target of SCRUB_STATES) {
        await scrollToProgress(page, target);
        if (target >= 0.55) {
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
            `overflow at ${target}`,
          ).toBeLessThanOrEqual(0);
        }
        const clearance = await measureClearance(page);
        worstBox = Math.min(worstBox, clearance.boxGap);
        worstInk = Math.min(worstInk, clearance.inkGap);
        if (clearance.measuredLines > 0) {
          expect(clearance.boxGap, `box at ${target}`).toBeGreaterThanOrEqual(-0.5);
          expect(clearance.inkGap, `ink at ${target}`).toBeGreaterThanOrEqual(7.5);
        }
      }

      await scrollToProgress(page, 0);
      await dispatchOrientationSeries(page, 95, 12, 8);

      // Full tilt in all four sign combinations plus the rest posture.
      const combinations = [
        { nx: 1, ny: 1 },
        { nx: 1, ny: -1 },
        { nx: -1, ny: 1 },
        { nx: -1, ny: -1 },
        { nx: 0, ny: 0 },
      ];
      for (const { nx, ny } of combinations) {
        await dispatchOrientationSeries(page, 95 + 25 * ny, 12 + 25 * nx, 30);
        await page.waitForTimeout(1250);
        const clearance = await measureClearance(page);
        worstBox = Math.min(worstBox, clearance.boxGap);
        worstInk = Math.min(worstInk, clearance.inkGap);
        expect(clearance.boxGap, `box at gyro ${nx},${ny}`).toBeGreaterThanOrEqual(-0.5);
        expect(clearance.inkGap, `ink at gyro ${nx},${ny}`).toBeGreaterThanOrEqual(7.5);
      }

      // Applied offsets match the mobile budget (clock +/-min(24, 6.2vw) / 14)
      // and the v5 stars (48 % / 36 %).
      const amplitudeX = Math.min(24, 0.062 * viewport.width);
      await dispatchOrientationSeries(page, 120, 37, 30);
      await page.waitForTimeout(1250);
      const clock = await readTransform(page, 'img[src="/reloj.png"]');
      expect(Math.abs(clock.m41)).toBeGreaterThan(amplitudeX - 1.5);
      expect(Math.abs(clock.m41)).toBeLessThanOrEqual(amplitudeX + 0.2);
      expect(Math.abs(clock.m42)).toBeGreaterThan(13);
      expect(Math.abs(clock.m42)).toBeLessThanOrEqual(14.2);
      const sparks = await readTransform(page, '[data-experience-sky-sparks]');
      expect(Math.abs(sparks.m41 - 0.48 * amplitudeX)).toBeLessThan(0.1);
      const dust = await readTransform(page, '[data-experience-sky-dust]');
      expect(Math.abs(dust.m41 - 0.36 * amplitudeX)).toBeLessThan(0.1);

      console.log(
        `NO_OCCLUSION mobile ${viewport.width}x${viewport.height} ` +
          `worstBox=${worstBox.toFixed(2)} worstInk=${worstInk.toFixed(2)}`,
      );
    });
  });
}
