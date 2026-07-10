/**
 * The srcdex.dev vanity-import worker: a host router over the
 * static rule tables, answering anything declined with a
 * plain 404.
 */

import { newConsoleLogger, newGoGetHostRouter }
  from '@srcdex/go-get-import';

import type { Env } from './env';
import { hostRules } from './rules';

function notFound(): Response {
  return new Response('not found\n', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

// Development aid, wired on for now: answers `?resolve=1` with
// the JSON resolution and logs each request's path and repo.
// Flip to `false` (or drive it from config) before this fronts
// production.
const debugResolver: boolean = true;

const goGet = newGoGetHostRouter(hostRules, {
  resolve: debugResolver,
  logger: debugResolver ? newConsoleLogger('debug') : undefined,
});

const handler = {
  // `env` is unused but must be named to reach the third
  // positional argument, `ctx`, which carries the logger's
  // async work to waitUntil.
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response {
    return goGet.fetch(request, ctx) ?? notFound();
  },
} satisfies ExportedHandler<Env>;

export default handler;
