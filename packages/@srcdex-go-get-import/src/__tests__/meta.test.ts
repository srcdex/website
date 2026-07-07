import { describe, expect, it } from 'vitest';

import {
  escapeHTML,
  goImportMeta,
  goSourceMeta,
  isGitHubRepo,
} from '../index';

const SRCDEX_REPO = 'https://github.com/srcdex/srcdex';

interface EscapeRow {
  readonly name: string
  readonly value: string
  readonly want: string
}

const escapeRows: readonly EscapeRow[] = [
  {
    name: 'plain text passes through',
    value: 'srcdex.dev/cmd',
    want: 'srcdex.dev/cmd',
  },
  {
    name: 'markup characters are escaped',
    value: '<script>"x" & \'y\'</script>',
    want: '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;' +
      '&lt;/script&gt;',
  },
];

describe('escapeHTML', () => {
  it.each(escapeRows)('$name', ({ value, want }) => {
    expect(escapeHTML(value)).toBe(want);
  });
});

interface IsGitHubRepoRow {
  readonly name: string
  readonly repo: string
  readonly want: boolean
}

const isGitHubRepoRows: readonly IsGitHubRepoRow[] = [
  {
    name: 'GitHub repository',
    repo: SRCDEX_REPO,
    want: true,
  },
  {
    name: 'mixed-case GitHub host',
    repo: 'https://GitHub.com/srcdex/srcdex',
    want: true,
  },
  {
    name: 'other forge',
    repo: 'https://git.example.com/srcdex/srcdex',
    want: false,
  },
];

describe('isGitHubRepo', () => {
  it.each(isGitHubRepoRows)('$name', ({ repo, want }) => {
    expect(isGitHubRepo(repo)).toBe(want);
  });
});

describe('goImportMeta', () => {
  it('renders the exact meta tag', () => {
    expect(goImportMeta('srcdex.dev', 'git', SRCDEX_REPO)).toBe(
      '<meta name="go-import" content="srcdex.dev git ' +
      `${SRCDEX_REPO}">`,
    );
  });

  it('escapes request-controlled values', () => {
    const got = goImportMeta('evil"host', 'git', SRCDEX_REPO);
    expect(got).toContain('evil&quot;host');
    expect(got).not.toContain('evil"host');
  });
});

describe('goSourceMeta', () => {
  it('renders the exact meta tag for GitHub repositories', () => {
    expect(goSourceMeta('srcdex.dev', SRCDEX_REPO, 'main')).toBe(
      '<meta name="go-source" content="srcdex.dev ' +
      `${SRCDEX_REPO} ` +
      `${SRCDEX_REPO}/tree/main{/dir} ` +
      `${SRCDEX_REPO}/blob/main{/dir}/{file}#L{line}">`,
    );
  });

  it('returns undefined for repositories elsewhere', () => {
    const repo = 'https://git.example.com/srcdex/srcdex';
    expect(goSourceMeta('srcdex.dev', repo, 'main'))
      .toBeUndefined();
  });
});
