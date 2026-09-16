import { expect, test, type Page } from '@playwright/test';

/**
 * Scene 01 — DrinkTimeline (§28/§29): phase windows, the intro→drink match cut
 * and the small garnish-dial lock. DOM/geometry assertions only (R5), no pixel
 * diffs: the continuity pixel sampling lives in the sky/tilt spec (C2).
 */

const CLOCK_CANVAS_W = 1672;
const CLOCK_CANVAS_H = 941;
/** Dial centre of reloj.png (the garnish-match reference, ±6 px). */
const CLOCK_DIAL = { x: 826.1 / CLOCK_CANVAS_W, y: 475.1 / CLOCK_CANVAS_H };
/** Dial origin of reloj-gajo.png (54.4 % / 49.4 % of the master). */
const GARNISH_DIAL = { x: 0.544, y: 0.494 };
/** clock-bbox.json visible fractions of the 1672×941 reloj.png canvas. */
const CLOCK_BBOX = {
  x0: 0.22129186602870812,
  x1: 0.77811004784689,
  y0: 0.007438894792773645,
  y1: 0.9681190223166843,
};

const DRINK_STATES = [
  '[data-drink-handoff-clock]',
  '[data-drink-base]',
  '[data-drink-garnish]',
  '[data-drink-final]',
];

async function drinkSnapshot(page: Page): Promise<number[]> {
  return page.evaluate((selectors) => {
    const values: number[] = [window.scrollY];
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!node) continue;
      const style = getComputedStyle(node);
      const matrix = new DOMMatrixReadOnly(
        style.transform === 'none' ? undefined : style.transform,
      );
      values.push(Number.parseFloat(style.opacity) || 0, matrix.m11, matrix.m42);
    }
    return values;
  }, DRINK_STATES);
}

async function waitForDrinkSettle(page: Page, timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let previous = await drinkSnapshot(page);
  while (Date.now() < deadline) {
    await page.waitForTimeout(80);
    const next = await drinkSnapshot(page);
    let stable = next.length === previous.length;
    if (stable) {
      for (let i = 0; i < next.length; i += 1) {
        if (Math.abs(next[i] - previous[i]) > 0.01) {
          stable = false;
          break;
        }
      }
    }
    if (stable) return;
    previous = next;
  }
}

async function drinkProgress(page: Page): Promise<number> {
  return page.evaluate(() => {
    const section = document.querySelector('[data-clock-drink]');
    if (!(section instanceof HTMLElement)) throw new Error('drink section missing');
    const top = section.getBoundingClientRect().top + window.scrollY;
    const distance = Math.max(0, section.offsetHeight - window.innerHeight);
    return distance > 0 ? (window.scrollY - top) / distance : 0;
  });
}

async function scrollDrinkTo(page: Page, target: number): Promise<number> {
  await page.evaluate((progress) => {
    const section = document.querySelector('[data-clock-drink]');
    if (!(section instanceof HTMLElement)) throw new Error('drink section missing');
    const top = section.getBoundingClientRect().top + window.scrollY;
    const distance = Math.max(0, section.offsetHeight - window.innerHeight);
    window.scrollTo(0, top + distance * progress);
  }, target);
  // Lenis' easing tail can still be in flight when the layout looks stable;
  // wait until the requested progress is reached, then give the scrub one
  // render tick before sampling the rendered state.
  await expect
    .poll(async () => Math.abs((await drinkProgress(page)) - target), { timeout: 5000 })
    .toBeLessThan(0.001);
  await page.waitForTimeout(120);
  await waitForDrinkSettle(page);
  return drinkProgress(page);
}

interface DrinkProbe {
  handoff: number;
  base: number;
  garnish: number;
  final: number;
  finalScale: number;
}

async function readDrink(page: Page): Promise<DrinkProbe> {
  return page.evaluate(() => {
    const opacityOf = (selector: string) => {
      const node = document.querySelector(selector);
      return node ? Number.parseFloat(getComputedStyle(node).opacity) : Number.NaN;
    };
    const finalNode = document.querySelector<HTMLElement>('[data-drink-final]');
    const finalStyle = finalNode ? getComputedStyle(finalNode) : null;
    const matrix = finalStyle
      ? new DOMMatrixReadOnly(finalStyle.transform === 'none' ? undefined : finalStyle.transform)
      : new DOMMatrixReadOnly();
    return {
      handoff: opacityOf('[data-drink-handoff-clock]'),
      base: opacityOf('[data-drink-base]'),
      garnish: opacityOf('[data-drink-garnish]'),
      final: opacityOf('[data-drink-final]'),
      finalScale: Math.hypot(matrix.m11, matrix.m12),
    };
  });
}

/** Waits until init applied the Scene 01 hidden state (final hidden by JS). */
async function waitForDrinkReady(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const node = document.querySelector('[data-drink-final]');
          return node ? getComputedStyle(node).opacity : '1';
        }),
      { timeout: 15000 },
    )
    .toBe('0');
  // The load-entry tween writes `y` on the same clock the scrub targets; wait
  // for it to finish so the scrub state is the only owner of the transform.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const node = document.querySelector('[data-experience-clock]');
          return node ? getComputedStyle(node).opacity : '0';
        }),
      { timeout: 15000 },
    )
    .toBe('1');
  await page.waitForTimeout(400);
}

/** Match-cut probe: both clocks' visible bbox centres + the two viewports. */
async function readHandoffGeometry(page: Page) {
  return page.evaluate((visible) => {
    const boxes = Array.from(document.querySelectorAll('img[src="/reloj.png"]')).map((img) => {
      const rect = img.getBoundingClientRect();
      const wrapper = img.closest('[data-experience-clock], [data-drink-handoff-clock]');
      return {
        cx: rect.left + rect.width * ((visible.x0 + visible.x1) / 2),
        cy: rect.top + rect.height * ((visible.y0 + visible.y1) / 2),
        h: rect.height * (visible.y1 - visible.y0),
        opacity: wrapper ? Number.parseFloat(getComputedStyle(wrapper).opacity) : 1,
      };
    });
    const introViewport = document.querySelector('.experience-intro__viewport');
    const drinkViewport = document.querySelector('.clock-drink__viewport');
    return {
      intro: boxes[0],
      handoff: boxes[1],
      introTop: introViewport ? introViewport.getBoundingClientRect().top : null,
      drinkTop: drinkViewport ? drinkViewport.getBoundingClientRect().top : null,
    };
  }, CLOCK_BBOX);
}

test.describe('Scene 01 · DrinkTimeline', () => {
  test('scrubs the §29 phases: match hold → reveal → crossfade → bake → final (desktop)', async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await waitForDrinkReady(page);

    // 0–3 % HANDOFF CROSSFADE (§24): the handoff clock fades in at the dock
    // while the Scene 00 clock fades out at the end of the intro scrub.
    expect(Math.abs((await scrollDrinkTo(page, 0)) - 0)).toBeLessThan(0.01);
    let probe = await readDrink(page);
    expect(probe.handoff).toBe(0);
    expect(probe.base).toBe(0);
    expect(probe.garnish).toBe(0);
    expect(probe.final).toBe(0);

    expect(Math.abs((await scrollDrinkTo(page, 0.015)) - 0.015)).toBeLessThan(0.01);
    probe = await readDrink(page);
    expect(probe.handoff).toBeGreaterThan(0.2);
    expect(probe.handoff).toBeLessThan(0.8);

    // 3–10 % MATCH HOLD: only the handoff clock.
    expect(Math.abs((await scrollDrinkTo(page, 0.06)) - 0.06)).toBeLessThan(0.01);
    probe = await readDrink(page);
    expect(probe.handoff).toBe(1);
    expect(probe.base).toBe(0);

    // 8–36 % REVEAL: the base rises behind the clock.
    expect(Math.abs((await scrollDrinkTo(page, 0.2)) - 0.2)).toBeLessThan(0.01);
    probe = await readDrink(page);
    expect(probe.handoff).toBe(1);
    expect(probe.base).toBeGreaterThan(0.2);
    expect(probe.base).toBeLessThan(0.6);
    expect(probe.final).toBe(0);

    // 42–58 % CROSSFADE: at the midpoint both silhouettes share the frame.
    expect(Math.abs((await scrollDrinkTo(page, 0.5)) - 0.5)).toBeLessThan(0.01);
    probe = await readDrink(page);
    expect(Math.abs(probe.handoff - 0.5)).toBeLessThan(0.1);
    expect(Math.abs(probe.garnish - 0.5)).toBeLessThan(0.1);
    expect(probe.base).toBe(1);
    expect(probe.final).toBe(0);

    // 58–72 % COMPOSITE HOLD: base + garnish only.
    expect(Math.abs((await scrollDrinkTo(page, 0.65)) - 0.65)).toBeLessThan(0.01);
    probe = await readDrink(page);
    expect(probe.handoff).toBe(0);
    expect(probe.garnish).toBe(1);
    expect(probe.base).toBe(1);
    expect(probe.final).toBe(0);

    // 72–84 % BAKE: short crossfade to the baked final.
    expect(Math.abs((await scrollDrinkTo(page, 0.78)) - 0.78)).toBeLessThan(0.01);
    probe = await readDrink(page);
    expect(Math.abs(probe.final - 0.5)).toBeLessThan(0.12);
    expect(Math.abs(probe.base - 0.5)).toBeLessThan(0.12);
    expect(Math.abs(probe.garnish - 0.5)).toBeLessThan(0.12);

    // 84–100 % FINAL HOLD: only trago-final, breathing back to scale 1.
    expect(Math.abs((await scrollDrinkTo(page, 1)) - 1)).toBeLessThan(0.01);
    probe = await readDrink(page);
    expect(probe.final).toBe(1);
    expect(probe.base).toBe(0);
    expect(probe.garnish).toBe(0);
    expect(probe.handoff).toBe(0);
    expect(Math.abs(probe.finalScale - 1)).toBeLessThan(0.005);
  });

  test('match cut: both clocks are co-located at the boundary (desktop + mobile)', async ({
    page,
  }) => {
    test.setTimeout(120000);

    for (const preset of [
      { width: 1440, height: 900, dock: { x: 0.575, y: 0.462 } },
      { width: 390, height: 844, dock: { x: 0.664, y: 0.425 } },
    ]) {
      await page.setViewportSize({ width: preset.width, height: preset.height });
      await page.goto('/');
      await waitForDrinkReady(page);

      // Drink progress 0 sits 4svh before the intro stops being pinned:
      // Scene 01 overlaps Scene 00 by 104svh, so both viewports are pinned at
      // the same screen position and both clocks sit on the §14 dock point.
      expect(Math.abs(await scrollDrinkTo(page, 0))).toBeLessThan(0.01);
      const geometry = await readHandoffGeometry(page);

      expect(geometry.introTop, `intro viewport pinned ${preset.width}`).toBeCloseTo(0, 0);
      expect(geometry.drinkTop, `drink viewport pinned ${preset.width}`).toBeCloseTo(0, 0);
      expect(geometry.handoff).toBeDefined();
      if (!geometry.intro || !geometry.handoff) continue;

      const dock = { x: preset.width * preset.dock.x, y: preset.height * preset.dock.y };
      for (const [label, clock] of [
        ['scene00', geometry.intro],
        ['scene01', geometry.handoff],
      ] as const) {
        expect(Math.abs(clock.cx - dock.x), `${label} dx ${preset.width}`).toBeLessThan(2);
        expect(Math.abs(clock.cy - dock.y), `${label} dy ${preset.width}`).toBeLessThan(2);
      }
      // Same object: identical visible size, position and handed-over opacity.
      expect(Math.abs(geometry.handoff.cx - geometry.intro.cx)).toBeLessThan(1);
      expect(Math.abs(geometry.handoff.cy - geometry.intro.cy)).toBeLessThan(1);
      expect(Math.abs(geometry.handoff.h - geometry.intro.h)).toBeLessThan(0.5);

      // The swap instant: Scene 00's clock is still opaque and Scene 01's
      // handoff clock is still hidden, both on the dock: no frame ever shows
      // two clocks. The fade windows overlap (intro 97–100 %, drink 0–3 %).
      expect(geometry.intro.opacity).toBe(1);
      expect(geometry.handoff.opacity).toBe(0);

      // The two fade windows differ per breakpoint (the drink scrub length and
      // the 4-unit overlap), so walk the window and require at least one real
      // crossfade sample: both clocks partially visible, exactly co-located.
      let crossfadeSeen = false;
      for (const step of [0.008, 0.014, 0.02, 0.026, 0.032, 0.038]) {
        await scrollDrinkTo(page, step);
        const mid = await readHandoffGeometry(page);
        const introOpacity = mid.intro?.opacity ?? 0;
        const handoffOpacity = mid.handoff?.opacity ?? 0;
        if (
          introOpacity > 0.15 &&
          introOpacity < 0.92 &&
          handoffOpacity > 0.15 &&
          handoffOpacity < 0.92
        ) {
          crossfadeSeen = true;
          expect(Math.abs((mid.handoff?.cx ?? 0) - (mid.intro?.cx ?? 0))).toBeLessThan(2);
          expect(Math.abs((mid.handoff?.cy ?? 0) - (mid.intro?.cy ?? 0))).toBeLessThan(2);
          break;
        }
      }
      expect(crossfadeSeen, 'overlapping crossfade sample').toBe(true);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });

  test('locks the handoff clock onto the garnish dial with rotation ≤ 2deg', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await waitForDrinkReady(page);

    const target = await scrollDrinkTo(page, 0.5);
    expect(Math.abs(target - 0.5)).toBeLessThan(0.01);

    const geometry = await page.evaluate(
      ({ clockDial, garnishDial }) => {
        const clockImg = document.querySelector('[data-drink-handoff-clock] img');
        const garnish = document.querySelector('[data-drink-garnish]');
        if (!(clockImg instanceof HTMLElement) || !(garnish instanceof HTMLElement)) {
          throw new Error('lock nodes missing');
        }
        const clockBox = clockImg.getBoundingClientRect();
        const garnishBox = garnish.getBoundingClientRect();
        const style = getComputedStyle(clockImg);
        const matrix = new DOMMatrixReadOnly(
          style.transform === 'none' ? undefined : style.transform,
        );
        return {
          clockDial: {
            x: clockBox.left + clockBox.width * clockDial.x,
            y: clockBox.top + clockBox.height * clockDial.y,
          },
          garnishDial: {
            x: garnishBox.left + garnishBox.width * garnishDial.x,
            y: garnishBox.top + garnishBox.height * garnishDial.y,
          },
          rotation: (Math.atan2(matrix.m12, matrix.m11) * 180) / Math.PI,
        };
      },
      { clockDial: CLOCK_DIAL, garnishDial: GARNISH_DIAL },
    );

    expect(Math.abs(geometry.clockDial.x - geometry.garnishDial.x)).toBeLessThan(2);
    expect(Math.abs(geometry.clockDial.y - geometry.garnishDial.y)).toBeLessThan(2);
    expect(Math.abs(geometry.rotation - 2)).toBeLessThan(0.1);
  });

  test('is fully reversible: scrolling back restores the earlier phases', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await waitForDrinkReady(page);

    await scrollDrinkTo(page, 1);
    expect((await readDrink(page)).final).toBe(1);

    await scrollDrinkTo(page, 0.65);
    let probe = await readDrink(page);
    expect(probe.final).toBe(0);
    expect(probe.garnish).toBe(1);

    await scrollDrinkTo(page, 0);
    probe = await readDrink(page);
    expect(probe.handoff).toBe(0);
    expect(probe.base).toBe(0);
    expect(probe.garnish).toBe(0);
    expect(probe.final).toBe(0);
  });
});
