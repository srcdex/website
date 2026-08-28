/**
 * go-import / go-source meta-tag rendering. All interpolated
 * values are HTML-escaped here; callers embed the returned
 * markup verbatim.
 */

import { escapeHTML } from './escape';

const GITHUB_PREFIX = 'https://github.com/';

/**
 * Reports whether a repository URL is GitHub-hosted, which
 * gates go-source meta tags and file-to-blob redirects. The
 * host is matched case-insensitively.
 */
export function isGitHubRepo(repo: string): boolean {
  return repo.toLowerCase().startsWith(GITHUB_PREFIX);
}

/** Renders the go-import meta tag for a module root. */
export function goImportMeta(
  importRoot: string,
  vcs: string,
  repo: string,
): string {
  const content = escapeHTML(`${importRoot} ${vcs} ${repo}`);
  return `<meta name="go-import" content="${content}">`;
}

/**
 * Renders the go-source meta tag for GitHub-hosted
 * repositories; returns `undefined` for repositories hosted
 * elsewhere, which get no source links. The tag describes a
 * git checkout, so callers gate on the effective `vcs` —
 * `goGetHTML` emits it only when the matched rule's vcs is
 * `git`.
 */
export function goSourceMeta(
  importRoot: string,
  repo: string,
  ref: string,
): string | undefined {
  if (!isGitHubRepo(repo)) {
    return undefined;
  }
  const dir = `${repo}/tree/${ref}{/dir}`;
  const file = `${repo}/blob/${ref}{/dir}/{file}#L{line}`;
  const content =
    escapeHTML(`${importRoot} ${repo} ${dir} ${file}`);
  return `<meta name="go-source" content="${content}">`;
}
