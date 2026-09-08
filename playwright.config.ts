import { defineConfig, devices } from '@playwright/test';

// E2E runs against the production build (§36).
//
// The webServer uses the standalone node entry directly (fallback D13).
// Reason: in non-interactive sessions (Playwright spawn, CI), `astro preview`
// auto-daemonizes (`--background` behavior) and detaches, which breaks the
// webServer lifecycle — the spawned command exits immediately and the detached
// server keeps running, hanging the test run. The node entry below always runs
// in the foreground. `pnpm preview` remains the documented manual command for
// humans (it works fine in an interactive terminal).
export default defineConfig({
  testDir: 'tests/e2e',

  use: {
    baseURL: 'http://localhost:4321/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  webServer: {
    command: 'node ./dist/server/entry.mjs',
    url: 'http://localhost:4321/',
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    env: {
      HOST: '127.0.0.1',
      PORT: '4321',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
