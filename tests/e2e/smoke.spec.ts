import { expect, test } from '@playwright/test';

test.describe('home', () => {
  test('renders with SEO metadata and zero console/page errors', async ({ page }) => {
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

    await expect(page.locator('html')).toHaveAttribute('lang', 'es-AR');

    const title = (await page.title()).trim();
    expect(title.length).toBeGreaterThan(0);

    await expect(page.locator('meta[name="description"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(1);
    await expect(page.locator('h1')).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

test.describe('health', () => {
  test('GET /api/health responds 200 with ok status (SSR)', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});

test.describe('robots', () => {
  test('GET /robots.txt responds 200 with User-agent', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('User-agent');
  });
});

test.describe('404', () => {
  test('GET /404-test responds 404', async ({ request }) => {
    const response = await request.get('/404-test');
    expect(response.status()).toBe(404);
  });
});
