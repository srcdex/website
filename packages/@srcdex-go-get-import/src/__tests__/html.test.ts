import { describe, expect, it } from 'vitest';

import { goGetHTML, type RuleMatch } from '../index';

const SRCDEX_REPO = 'https://github.com/srcdex/srcdex';

function newRuleMatch(
  repo: string,
  vcs: string,
  ref: string,
  module = true,
): RuleMatch {
  return {
    captures: {},
    repo,
    rootPath: '',
    subPath: '',
    rule: { prefix: '', repo, vcs, ref, module },
  };
}

describe('goGetHTML', () => {
  const match = newRuleMatch(SRCDEX_REPO, 'git', 'main');
  const html = goGetHTML('srcdex.dev', 'srcdex.dev/cmd', match);

  it('includes the go-import meta tag', () => {
    expect(html).toContain(
      '<meta name="go-import" content="srcdex.dev git ' +
      `${SRCDEX_REPO}">`,
    );
  });

  it('includes the go-source meta tag', () => {
    expect(html).toContain('<meta name="go-source"');
  });

  it('refreshes to pkg.go.dev', () => {
    expect(html).toContain(
      '<meta http-equiv="refresh" content="5; ' +
      'url=https://pkg.go.dev/srcdex.dev/cmd">',
    );
  });

  it('titles the document with the import path', () => {
    expect(html).toContain('<title>go get srcdex.dev/cmd</title>');
  });

  it('offers clone, get, and import lines', () => {
    expect(html).toContain(
      `git clone <a href="${SRCDEX_REPO}">${SRCDEX_REPO}</a>`,
    );
    expect(html).toContain('go get ');
    expect(html).toContain('import "');
  });

  it('omits go-source for non-git rules', () => {
    const hg = newRuleMatch(SRCDEX_REPO, 'hg', 'main');
    const got = goGetHTML('srcdex.dev', 'srcdex.dev', hg);
    expect(got).not.toContain('go-source');
    expect(got).toContain('hg clone');
  });

  it('omits go-source for repositories elsewhere', () => {
    const repo = 'https://git.example.com/srcdex/srcdex';
    const other = newRuleMatch(repo, 'git', 'main');
    const got = goGetHTML('srcdex.dev', 'srcdex.dev', other);
    expect(got).not.toContain('go-source');
    expect(got).toContain('go-import');
  });

  it('offers the repository on a bare non-module root', () => {
    const x = 'https://github.com/darvaza-proxy/x';
    const nonModule = newRuleMatch(x, 'git', 'main', false);
    const got = goGetHTML('darvaza.org/x', 'darvaza.org/x',
      nonModule);
    expect(got).toContain(
      `<meta http-equiv="refresh" content="5; url=${x}">`,
    );
    expect(got).not.toContain('url=https://pkg.go.dev');
  });

  it('omits the get and import lines on a bare non-module root',
    () => {
      const x = 'https://github.com/darvaza-proxy/x';
      const nonModule = newRuleMatch(x, 'git', 'main', false);
      const got = goGetHTML('darvaza.org/x', 'darvaza.org/x',
        nonModule);
      expect(got).toContain(`git clone <a href="${x}">${x}</a>`);
      expect(got).not.toContain('<pre>go get ');
      expect(got).not.toContain('import "');
    });

  it('keeps pkg.go.dev below a non-module root', () => {
    const x = 'https://github.com/darvaza-proxy/x';
    const below = {
      ...newRuleMatch(x, 'git', 'main', false),
      rootPath: '/x',
      subPath: 'web',
    };
    const got = goGetHTML('darvaza.org/x',
      'darvaza.org/x/web', below);
    expect(got).toContain(
      'url=https://pkg.go.dev/darvaza.org/x/web',
    );
    expect(got).toContain('<pre>go get ');
    expect(got).toContain('import "');
  });

  it('escapes request-controlled interpolations', () => {
    const evil = '<script>alert(1)</script>';
    const got = goGetHTML(evil, evil, match);
    expect(got).not.toContain(evil);
    expect(got).toContain('&lt;script&gt;');
  });
});
