import { describe, expect, it } from 'vitest';

import {
  type ExecutionContextLike,
  newGoGetHostRouter,
  type Rule,
} from '../index';

const SRCDEX_REPO = 'https://github.com/srcdex/srcdex';
const X_REPO = 'https://github.com/darvaza-proxy/x';
const TEMPLATE = 'https://github.com/darvaza-proxy/{repo}';

const srcdexRules: readonly Rule[] = [
  { prefix: '', repo: SRCDEX_REPO },
];
const darvazaRules: readonly Rule[] = [
  { prefix: '/x', repo: X_REPO, module: false },
  { prefix: '/{repo}', repo: TEMPLATE },
];

describe('newGoGetHostRouter', () => {
  const router = newGoGetHostRouter({
    'srcdex.dev': srcdexRules,
    'darvaza.org': darvazaRules,
  });

  it('dispatches to the matching hostname', async () => {
    const got = router.fetch(
      new Request('https://srcdex.dev/?go-get=1'),
    );
    expect(got?.status).toBe(200);
    const body = await got?.text();
    expect(body).toContain('content="srcdex.dev git');
  });

  it('keeps rule tables per hostname', async () => {
    const got = router.fetch(
      new Request('https://darvaza.org/slog?go-get=1'),
    );
    expect(got?.status).toBe(200);
    const body = await got?.text();
    expect(body).toContain(
      'content="darvaza.org/slog git ' +
      'https://github.com/darvaza-proxy/slog"',
    );
  });

  it('routes repository roots per hostname', () => {
    const got =
      router.fetch(new Request('https://darvaza.org/x'));
    expect(got?.headers.get('Location')).toBe(X_REPO);
  });

  it('resolves URLs through the hostname map', () => {
    const got =
      router.resolve(new URL('https://darvaza.org/x/web'));
    expect(got).toEqual({
      captures: {},
      repo: X_REPO,
      rootPath: '/x',
      subPath: 'web',
      rule: {
        prefix: '/x',
        repo: X_REPO,
        vcs: 'git',
        ref: 'main',
        module: false,
      },
    });
  });

  it('declines unknown hostnames', () => {
    const request =
      new Request('https://other.example/?go-get=1');
    expect(router.fetch(request)).toBeUndefined();
    expect(router.resolve(new URL(request.url)))
      .toBeUndefined();
  });

  it('matches hostname keys case-insensitively', async () => {
    const mixed =
      newGoGetHostRouter({ 'MiXed.Example': srcdexRules });
    const got = mixed.fetch(
      new Request('https://mixed.example/?go-get=1'),
    );
    expect(got?.status).toBe(200);
    const body = await got?.text();
    expect(body).toContain('content="MiXed.Example git');
  });

  it('rejects host keys that differ only in case', () => {
    expect(() => newGoGetHostRouter({
      'srcdex.dev': srcdexRules,
      'SrcDex.Dev': darvazaRules,
    })).toThrow(/duplicate host key/);
  });

  it('matches mixed-case request hostnames against a ' +
    'lowercase key', async () => {
    const request = new Request('https://SrcDex.Dev/?go-get=1');
    const got = router.fetch(request);
    expect(got?.status).toBe(200);
    const body = await got?.text();
    expect(body).toContain('content="srcdex.dev git');

    expect(
      router.resolve(new URL('https://SrcDex.Dev/cmd'))?.repo,
    ).toBe(SRCDEX_REPO);
  });

  it('applies shared settings to every host', () => {
    const permanent = newGoGetHostRouter(
      { 'srcdex.dev': srcdexRules },
      { redirectCode: 308 },
    );
    const got =
      permanent.fetch(new Request('https://srcdex.dev/cmd'));
    expect(got?.status).toBe(308);
  });

  it('applies shared rule defaults to every host', () => {
    const master = newGoGetHostRouter(
      { 'srcdex.dev': srcdexRules },
      { ruleDefaults: { ref: 'master' } },
    );
    const got =
      master.fetch(new Request('https://srcdex.dev/main.go'));
    expect(got?.headers.get('Location'))
      .toBe(`${SRCDEX_REPO}/blob/master/main.go`);
  });

  describe('hostHeader override', () => {
    const HEADER = 'X-Debug-Host';
    const overriding = newGoGetHostRouter(
      { 'srcdex.dev': srcdexRules },
      { hostHeader: HEADER },
    );

    it('routes by the header value when present', async () => {
      const got = overriding.fetch(
        new Request('https://preview.example/?go-get=1', {
          headers: { [HEADER]: 'srcdex.dev' },
        }),
      );
      expect(got?.status).toBe(200);
      expect(await got?.text())
        .toContain('content="srcdex.dev git');
    });

    it('lowercases the header value to match table keys', () => {
      const got = overriding.fetch(
        new Request('https://preview.example/?go-get=1', {
          headers: { [HEADER]: 'SrcDex.Dev' },
        }),
      );
      expect(got?.status).toBe(200);
    });

    it('falls back to the URL host when the header is absent',
      () => {
        const got = overriding.fetch(
          new Request('https://preview.example/?go-get=1'),
        );
        expect(got).toBeUndefined();
      });

    it('declines when the header names an unknown host', () => {
      const got = overriding.fetch(
        new Request('https://srcdex.dev/?go-get=1', {
          headers: { [HEADER]: 'unknown.example' },
        }),
      );
      expect(got).toBeUndefined();
    });

    it('ignores the header without the hostHeader setting', () => {
      const got = router.fetch(
        new Request('https://preview.example/?go-get=1', {
          headers: { 'X-Debug-Host': 'srcdex.dev' },
        }),
      );
      expect(got).toBeUndefined();
    });
  });

  it('forwards the execution context to the path router', () => {
    let waited: Promise<unknown> | undefined;
    const ctx: ExecutionContextLike = {
      waitUntil: (promise) => {
        waited = promise;
      },
    };
    const router = newGoGetHostRouter(
      { 'srcdex.dev': srcdexRules },
      { logger: () => Promise.resolve() },
    );
    router.fetch(new Request('https://srcdex.dev/cmd'), ctx);
    expect(waited).toBeInstanceOf(Promise);
  });
});
