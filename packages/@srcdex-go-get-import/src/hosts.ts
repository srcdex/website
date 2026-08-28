/**
 * Layer 2 — the host router. Rule tables keyed by hostname,
 * each backed by its own path router; the standalone
 * multi-domain worker shape.
 */

import type {
  GoGetHostRules,
  GoGetHostSettings,
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
 * the other. Rule paths stay case-sensitive. A
 * {@link GoGetHostSettings.hostHeader} may override the routing
 * host per request.
 */
export function newGoGetHostRouter(
  hosts: GoGetHostRules,
  settings: GoGetHostSettings = {},
): GoGetRouter {
  const { hostHeader, ...routerSettings } = settings;
  const routers = new Map<string, GoGetRouter>();
  for (const [host, rules] of Object.entries(hosts)) {
    const key = host.toLowerCase();
    if (routers.has(key)) {
      throw new Error(
        `duplicate host key (case-insensitive): ${host}`,
      );
    }
    routers.set(key, newGoGetRouter({ ...routerSettings, host, rules }));
  }

  // Keys are stored lowercased. A request's own hostname arrives
  // already lowercased from the URL parser; a value from the
  // host header is lowercased here to match.
  const routeHost = (request: Request): string => {
    const override = hostHeader && request.headers.get(hostHeader);
    return override ?
      override.toLowerCase() :
      new URL(request.url).hostname;
  };

  return {
    resolve: (url) => routers.get(url.hostname)?.resolve(url),
    fetch: (request, ctx) =>
      routers.get(routeHost(request))?.fetch(request, ctx),
  };
}
