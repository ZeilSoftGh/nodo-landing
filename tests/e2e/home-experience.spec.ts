import { expect, test } from '@playwright/test';

/**
 * Fase 01 — home experience (§58) + clock→drink §54.
 *
 * Assertions target DOM state and geometry only (R5): no visual frames, no
 * pixel snapshots. Tests 6 and 7 spin dedicated contexts because they need
 * non-default capabilities (JS disabled / reduced motion).
 */

test.describe('home experience (Fase 01)', () => {
  test('responds 200 with zero console/page errors and the clock→drink scene mounted (§54.1/§54.9)', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    // §61 — ScrollFilm is preserved in the repo but never mounted now.
    await expect(page.locator('[data-scroll-film]')).toHaveCount(0);
    await expect(page.locator('[data-clock-drink]')).toHaveCount(1);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('has exactly one h1 with the intro copy (§58.2/§13)', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toHaveCount(1);

    const text = (await page.locator('h1').textContent()) ?? '';
    expect(text.replace(/\s+/g, ' ').trim()).toMatch(/Bienvenido a la\s+experiencia NODO/);
  });

  test('renders the clock asset with explicit dimensions and priority (§58.3/D5/R7)', async ({
    page,
  }) => {
    await page.goto('/');

    // Two clocks exist now: the Scene 00 protagonist and the Scene 01 handoff
    // (§24). The first is the LCP candidate and keeps fetchpriority="high".
    const clock = page.locator('img[src="/reloj.png"]');
    await expect(clock).toHaveCount(2);
    await expect(clock.first()).toHaveAttribute('width', '1672');
    await expect(clock.first()).toHaveAttribute('height', '941');
    await expect(clock.first()).toHaveAttribute('fetchpriority', 'high');
    await expect(clock.first()).not.toHaveAttribute('loading', 'lazy');
  });

  test('mounts the clock→drink assets and the scene shell (§54.3–§54.7/§54.11)', async ({
    page,
  }) => {
    await page.goto('/');

    const scene = page.locator('[data-clock-drink]');
    await expect(scene).toHaveCount(1);

    // The clock exists twice by design (§24: protagonist + handoff); the drink
    // assets exist once.
    for (const [asset, count] of [
      ['/reloj.png', 2],
      ['/trago-base.png', 1],
      ['/reloj-gajo.png', 1],
      ['/trago-final.png', 1],
    ] as const) {
      await expect(page.locator(`img[src="${asset}"]`)).toHaveCount(count);
    }

    await expect(scene.locator('[data-drink-handoff-clock]')).toHaveCount(1);
    await expect(scene.locator('[data-drink-product]')).toHaveCount(1);
    await expect(scene.locator('[data-drink-base]')).toHaveCount(1);
    await expect(scene.locator('[data-drink-garnish]')).toHaveCount(1);
    await expect(scene.locator('[data-drink-final]')).toHaveCount(1);
    await expect(scene.locator('[data-drink-glow]')).toHaveCount(1);
    await expect(page.locator('[data-scroll-film]')).toHaveCount(0);

    // §44 — the drink set is second scene: fetchpriority low, clock stays high.
    for (const asset of ['/trago-base.png', '/reloj-gajo.png', '/trago-final.png']) {
      await expect(page.locator(`img[src="${asset}"]`)).toHaveAttribute('fetchpriority', 'low');
    }

    // §24/OBS-1 — the handoff clock must carry the exact Scene 00 clock shadow.
    const filters = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img[src="/reloj.png"]'));
      return images.map((img) => getComputedStyle(img).filter);
    });
    expect(filters).toHaveLength(2);
    expect(filters[1]).toBe(filters[0]);
    expect(filters[1]).not.toBe('none');
  });

  test('does not create horizontal overflow (§58.5/§54.8)', async ({ page }) => {
    await page.goto('/');

    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      )
      .toBeLessThanOrEqual(0);
  });

  test('keeps the essential content when JavaScript is disabled (§58.6/§44/§54.12)', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto('/');

    // §36 natural state: no JS means the baked final is the scene.
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-clock-drink]')).toBeVisible();
    await expect(page.locator('img[src="/trago-final.png"]')).toBeVisible();
    await expect(page.locator('[data-scroll-film]')).toHaveCount(0);

    const opacities = await page.evaluate(() => {
      const read = (selector: string) => {
        const node = document.querySelector(selector);
        return node ? getComputedStyle(node).opacity : null;
      };
      return {
        clock: read('[data-experience-clock]'),
        title: read('.experience-intro__title'),
        final: read('[data-drink-final]'),
        handoff: read('[data-drink-handoff-clock]'),
        base: read('[data-drink-base]'),
        garnish: read('[data-drink-garnish]'),
      };
    });
    expect(opacities.title).toBe('1');
    expect(opacities.clock).toBe('1');
    expect(opacities.final).toBe('1');
    expect(opacities.handoff).toBe('0');
    expect(opacities.base).toBe('0');
    expect(opacities.garnish).toBe('0');

    // SSR-only check: the drink layers carry no inline style attributes.
    const styled = await page.evaluate(
      () =>
        document.querySelectorAll('[data-clock-drink] [style], [data-drink-handoff-clock][style]')
          .length,
    );
    expect(styled).toBe(0);

    await context.close();
  });

  test('reduced motion never initializes the heavy scrub and shows the final (§58.7/§54.10)', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();

    await page.goto('/');

    // Lenis must not have been created: the html element carries no lenis
    // classes (respectReducedMotion guards inside createSmoothScroll as well).
    const htmlClasses = (await page.locator('html').getAttribute('class')) ?? '';
    expect(htmlClasses).not.toContain('lenis');

    // No GSAP inline styles were ever written: the title and the clock carry
    // no hidden states and no inline transforms.
    const titleStyle = (await page.locator('.experience-intro__title').getAttribute('style')) ?? '';
    expect(titleStyle).not.toContain('opacity');
    expect(titleStyle).not.toContain('transform');

    const clockStyle = (await page.locator('[data-experience-clock]').getAttribute('style')) ?? '';
    expect(clockStyle).not.toContain('opacity');
    expect(clockStyle).not.toContain('transform');

    // §35/§54.10 — the drink scene is the baked final only.
    await expect(page.locator('img[src="/trago-final.png"]')).toBeVisible();
    const handoffDisplay = await page
      .locator('[data-drink-handoff-clock]')
      .evaluate((el) => getComputedStyle(el).display);
    expect(handoffDisplay).toBe('none');

    await context.close();
  });
});
