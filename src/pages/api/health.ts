import type { APIRoute } from 'astro';

// SSR health check: proves the Node adapter runtime works (§19).
// No prerender export on purpose: this endpoint must stay server-rendered.
export const GET: APIRoute = () => {
  return Response.json(
    { status: 'ok' },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
};
