import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Astro does NOT load .env files inside astro.config.
// In production, SITE_URL is injected as a real process environment variable.
const site = process.env.SITE_URL ?? 'http://localhost:4321';

export default defineConfig({
  site,

  server: {
    allowedHosts: ['14f7-190-97-120-245.ngrok-free.app']
  },

  output: 'server',

  adapter: node({
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
