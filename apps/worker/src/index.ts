import type { Env } from './env';

const handler: ExportedHandler<Env> = {
  fetch: () => new Response('srcdex-website (stub)\n', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  }),
};

export default handler;
