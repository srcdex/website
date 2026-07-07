/**
 * Layer 1 — the path router. One ordered rule table over one
 * host (pinned by option or taken from each request's URL).
 * This is the layer a host-routing dispatcher mounts per
 * hostname.
 */

import type {
  ExecutionContextLike,
  GoGetImportOptions,
  GoGetRouter,
  RuleMatch,
} from './types';
import { goGetHTML } from './html';
import {
  compileRules,
  DEFAULT_FILE_EXTENSIONS,
  isFilePath,
  matchRules,
} from './match';
import { isGitHubRepo } from './meta';

/**
 * Normalises a request path for matching: runs of slashes
 * collapse into one, and the trailing slash is stripped.
 */
function routePath(url: URL): string {
  return url.pathname
    .replaceAll(/\/{2,}/g, '/')
    .replace(/\/$/, '');
}

function goGetResponse(
  importRoot: string,
  importPath: string,
  match: RuleMatch,
): Response {
  const body = goGetHTML(importRoot, importPath, match);
  return new Response(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Builds the path router for one ordered rule table.
 * `resolve` maps a URL's path to its rule match; `fetch`
 * answers vanity-import requests: `?go-get=1` gets the
 * meta-tag document, bare roots marked `module: false`
 * redirect to their repository, file paths on GitHub
 * repositories redirect to the blob view, and everything
 * else redirects to pkg.go.dev. Non-GET/HEAD requests and
 * unmatched paths decline with `undefined`.
 */
export function newGoGetRouter(
  options: GoGetImportOptions,
): GoGetRouter {
  const {
    rules, host, redirectCode = 302, ruleDefaults,
    resolve: resolveEnabled = false, logger,
  } = options;
  const fileExtensions =
    options.fileExtensions ?? DEFAULT_FILE_EXTENSIONS;
  const compiled = compileRules(rules, ruleDefaults);

  const resolve = (url: URL): RuleMatch | undefined =>
    matchRules(compiled, routePath(url), fileExtensions);

  const fetch = (
    request: Request,
    ctx?: ExecutionContextLike,
  ): Response | undefined => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return undefined;
    }

    const url = new URL(request.url);
    if (resolveEnabled && url.searchParams.get('resolve') === '1') {
      return Response.json({ match: resolve(url) });
    }

    const path = routePath(url);
    const match = matchRules(compiled, path, fileExtensions);
    // The logger is invoked synchronously; only a promise it
    // returns is handed to waitUntil, so its async tail is not
    // awaited before responding (best-effort without a context).
    const logged = logger?.(url, match);
    if (logged instanceof Promise) {
      ctx?.waitUntil(logged);
    }
    if (!match) {
      return undefined;
    }

    const importHost = host ?? url.hostname;
    const importRoot = importHost + match.rootPath;
    const importPath = importHost + path;

    // ?go-get=1 always gets the meta document — the Go
    // toolchain verifies a prefixed root by fetching the
    // root itself and comparing meta tags, so even
    // non-module roots must answer.
    if (url.searchParams.get('go-get') === '1') {
      return goGetResponse(importRoot, importPath, match);
    }

    if (!match.rule.module && match.subPath === '') {
      return Response.redirect(match.repo, redirectCode);
    }

    if (match.subPath !== '' &&
      isFilePath(match.subPath, fileExtensions) &&
      isGitHubRepo(match.repo)) {
      const blob =
        `${match.repo}/blob/${match.rule.ref}/${match.subPath}`;
      return Response.redirect(blob, redirectCode);
    }

    const docs = `https://pkg.go.dev/${importPath}`;
    return Response.redirect(docs, redirectCode);
  };

  return { resolve, fetch };
}
