import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// Astro does NOT load .env files inside astro.config.
// In production, SITE_URL is injected as a real process environment variable.
const site = process.env.SITE_URL ?? 'http://localhost:4321';

// Vercel sets VERCEL=1 for every build (system env vars are on by default for
// new projects). On Vercel the official adapter is required so `astro build`
// emits the Build Output API; without it the deployment has no routes and the
// platform answers 404. Locally we keep the Node standalone adapter so
// `pnpm preview` and the Playwright webServer (`node ./dist/server/entry.mjs`,
// D13/§36) keep working.
const isVercelBuild = Boolean(process.env.VERCEL);

export default defineConfig({
  site,

  server: {
    allowedHosts: ['14f7-190-97-120-245.ngrok-free.app'],
  },

  output: 'server',

  adapter: isVercelBuild
    ? vercel()
    : node({
        mode: 'standalone',
      }),

  integrations: [
    react(),
    sitemap({
      // Exclude technical routes from the sitemap (§17), plus /styleguide (N5):
      // the internal specimen is noindexed, so it must not be listed either.
      filter: (page) =>
        !new URL(page).pathname.startsWith('/api') &&
        !new URL(page).pathname.startsWith('/styleguide'),
    }),
  ],

  trailingSlash: 'never',

  compressHTML: true,

  // CSP is emitted on build + preview only (not in dev).
  security: {
    csp: true,
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
