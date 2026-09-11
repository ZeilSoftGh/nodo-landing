import { expect, test } from '@playwright/test';

/**
 * Fase 01 — home experience (§58).
 *
 * Assertions target DOM state and geometry only (R5): no visual frames, no
 * pixel snapshots. Tests 6 and 7 spin dedicated contexts because they need
 * non-default capabilities (JS disabled / reduced motion); playwright.config.ts
 * is inherited untouched (chromium project, node webServer).
 */

test.describe('home experience (Fase 01)', () => {
  test('responds 200 with zero console/page errors and the film fallback present (§58.1/§57)', async ({
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

    // The missing video material must not break anything: the fallback layer
    // (overlay) exists and no error is ever logged (N2).
    await expect(page.locator('[data-scroll-film] .scroll-film__overlay')).toHaveCount(1);

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

    const clock = page.locator('img[src="/reloj.png"]');
    await expect(clock).toHaveCount(1);
    await expect(clock).toHaveAttribute('width', '1672');
    await expect(clock).toHaveAttribute('height', '941');
    await expect(clock).toHaveAttribute('fetchpriority', 'high');
    await expect(clock).not.toHaveAttribute('loading', 'lazy');
  });

  test('has the scroll-film section with video element and overlay (§58.4)', async ({ page }) => {
    await page.goto('/');

    const film = page.locator('[data-scroll-film]');
    await expect(film).toHaveCount(1);
    await expect(film.locator('[data-scroll-film-video]')).toHaveCount(1);
    await expect(film.locator('.scroll-film__overlay')).toHaveCount(1);
  });

  test('does not create horizontal overflow (§58.5)', async ({ page }) => {
    await page.goto('/');

    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      )
      .toBeLessThanOrEqual(0);
  });

  test('keeps the layout complete when JavaScript is disabled (§58.6/§44)', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto('/');

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('img[src="/reloj.png"]')).toBeVisible();
    await expect(page.locator('[data-scroll-film]')).toBeVisible();

    // No permanently hidden critical elements: opacity must be 1 everywhere
    // the experience lives (§44 — states are hidden only via gsap.set, which
    // never ran).
    for (const selector of ['h1', '[data-experience-clock]', '[data-scroll-film]']) {
      const opacity = await page
        .locator(selector)
        .first()
        .evaluate((element) => getComputedStyle(element).opacity);
      expect(opacity, selector).toBe('1');
    }

    await context.close();
  });

  test('reduced motion never initializes the heavy scrub (§58.7/D8/§43)', async ({ browser }) => {
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

    await context.close();
  });
});
