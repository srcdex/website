/**
 * The `?go-get=1` HTML document: meta tags for the Go
 * toolchain plus a short human-friendly body that refreshes to
 * pkg.go.dev.
 */

import type { RuleMatch } from './types';
import { escapeHTML } from './escape';
import { goImportMeta, goSourceMeta } from './meta';

/** Seconds before the go-get page refreshes to pkg.go.dev. */
const REFRESH_SECONDS = 5;

/**
 * Renders the go-get response document for a matched import
 * path. The go-source meta tag is included only for GitHub
 * repositories tracked with git. The human-facing links and
 * refresh target pkg.go.dev, except on the bare root of a
 * `module: false` rule, where pkg.go.dev has no page: the
 * repository is offered instead and the `go get`/`import`
 * lines are omitted, as the root is not importable.
 */
export function goGetHTML(
  importRoot: string,
  importPath: string,
  match: RuleMatch,
): string {
  const { rule } = match;
  const tags = [goImportMeta(importRoot, rule.vcs, match.repo)];
  if (rule.vcs === 'git') {
    const source =
      goSourceMeta(importRoot, match.repo, rule.ref);
    if (source !== undefined) {
      tags.push(source);
    }
  }

  const importable = rule.module || match.subPath !== '';
  const target = importable ?
    `https://pkg.go.dev/${importPath}` :
    match.repo;
  const docs = escapeHTML(target);
  const path = escapeHTML(importPath);
  const repo = escapeHTML(match.repo);
  const vcs = escapeHTML(rule.vcs);

  const lines =
    [`<pre>${vcs} clone <a href="${repo}">${repo}</a></pre>`];
  if (importable) {
    lines.push(
      `<pre>go get <a href="${docs}">${path}</a></pre>`,
      `<pre>import "<a href="${docs}">${path}</a>"</pre>`,
    );
  }

  return `<!DOCTYPE html>
<html>
<head>
${tags.join('\n')}
<meta http-equiv="refresh" content="${REFRESH_SECONDS}; url=${docs}">
<title>go get ${path}</title>
</head>
<body>
${lines.join('\n')}
</body>
</html>
`;
}
