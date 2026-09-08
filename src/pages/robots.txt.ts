import type { APIRoute } from 'astro';

// Dynamic robots.txt controlled by PUBLIC_INDEXABLE, read from process.env at
// runtime (SSR endpoint, no prerender). Fail-closed: any value other than the
// exact string 'true' produces "Disallow: /" so a staging build can never be
// accidentally indexable (§16 + D8).
export const GET: APIRoute = () => {
  const indexable = process.env.PUBLIC_INDEXABLE === 'true';

  if (indexable) {
    const sitemapUrl = new URL('sitemap-index.xml', import.meta.env.SITE);
    const body = `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl.href}\n`;
    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  return new Response('User-agent: *\nDisallow: /\n', {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
