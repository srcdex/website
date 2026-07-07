/**
 * Layer 2 — the host router. Rule tables keyed by hostname,
 * each backed by its own path router; the standalone
 * multi-domain worker shape.
 */

import type {
  GoGetHostRules,
  GoGetImportSettings,
  GoGetRouter,
} from './types';
import { newGoGetRouter } from './router';

/**
 * Builds a router of routers: one path router per map entry,
 * selected by each URL's hostname. Unknown hostnames decline
 * — `resolve` returns `undefined` and `fetch` falls through.
 * Hostname keys match case-insensitively but each key, as
 * written, becomes its table's import host; two keys differing
 * only in case are rejected rather than one silently shadowing
 * the other. Rule paths stay case-sensitive.
 */
export function newGoGetHostRouter(
  hosts: GoGetHostRules,
  settings: GoGetImportSettings = {},
): GoGetRouter {
  const routers = new Map<string, GoGetRouter>();
  for (const [host, rules] of Object.entries(hosts)) {
    const key = host.toLowerCase();
    if (routers.has(key)) {
      throw new Error(
        `duplicate host key (case-insensitive): ${host}`,
      );
    }
    routers.set(key, newGoGetRouter({ ...settings, host, rules }));
  }

  // Keys are stored lowercased; lookups rely on the URL parser
  // having already lowercased `hostname`, so a mixed-case
  // request host still finds its table.
  return {
    resolve: (url) => routers.get(url.hostname)?.resolve(url),
    fetch: (request, ctx) => {
      const { hostname } = new URL(request.url);
      return routers.get(hostname)?.fetch(request, ctx);
    },
  };
}
