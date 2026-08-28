import { describe, expect, it } from 'vitest';

import {
  type ExecutionContextLike,
  newGoGetRouter,
  type Rule,
  type RuleMatch,
} from '../index';

const SRCDEX_REPO = 'https://github.com/srcdex/srcdex';
const OTHER_REPO = 'https://git.example.com/srcdex/srcdex';
const KAGAL_REPO = 'https://github.com/kagal-dev/kagal';
const X_REPO = 'https://github.com/darvaza-proxy/x';
const TEMPLATE = 'https://github.com/darvaza-proxy/{repo}';

const srcdexRules: readonly Rule[] = [
  { prefix: '', repo: SRCDEX_REPO },
];

function newRequest(url: string, method = 'GET'): Request {
  return new Request(url, { method });
}

describe('GoGetRouter.resolve', () => {
  const router = newGoGetRouter({ rules: srcdexRules });

  it('resolves a URL to its rule match', () => {
    const got =
      router.resolve(new URL('https://srcdex.dev/cmd/srcdex/'));
    expect(got).toEqual({
      captures: {},
      repo: SRCDEX_REPO,
      rootPath: '',
      subPath: 'cmd/srcdex',
      rule: {
        prefix: '',
        repo: SRCDEX_REPO,
        vcs: 'git',
        ref: 'main',
        module: true,
      },
    });
  });

  it('returns undefined for unclaimed paths', () => {
    const scoped = newGoGetRouter({
      rules: [{ prefix: '/slog', repo: SRCDEX_REPO }],
    });
    const got =
      scoped.resolve(new URL('https://srcdex.dev/other'));
    expect(got).toBeUndefined();
  });
});

describe('GoGetRouter.fetch', () => {
  const router = newGoGetRouter({ rules: srcdexRules });

  it('answers go-get requests with the meta document', async () => {
    const got =
      router.fetch(newRequest('https://srcdex.dev/?go-get=1'));
    expect(got?.status).toBe(200);
    expect(got?.headers.get('Content-Type'))
      .toBe('text/html; charset=utf-8');
    const body = await got?.text();
    expect(body).toContain(
      '<meta name="go-import" content="srcdex.dev git ' +
      `${SRCDEX_REPO}">`,
    );
    expect(body).toContain('<meta name="go-source"');
  });

  it('redirects file paths to the blob view', () => {
    const got = router.fetch(
      newRequest('https://srcdex.dev/cmd/srcdex/main.go'),
    );
    expect(got?.status).toBe(302);
    expect(got?.headers.get('Location'))
      .toBe(`${SRCDEX_REPO}/blob/main/cmd/srcdex/main.go`);
  });

  it('redirects package paths to pkg.go.dev', () => {
    const got = router.fetch(
      newRequest('https://srcdex.dev/cmd/srcdex'),
    );
    expect(got?.status).toBe(302);
    expect(got?.headers.get('Location'))
      .toBe('https://pkg.go.dev/srcdex.dev/cmd/srcdex');
  });

  it('strips trailing slashes before matching', () => {
    const got = router.fetch(
      newRequest('https://srcdex.dev/cmd/srcdex/'),
    );
    expect(got?.headers.get('Location'))
      .toBe('https://pkg.go.dev/srcdex.dev/cmd/srcdex');
  });

  it('collapses duplicate slashes before matching', () => {
    const got = router.fetch(
      newRequest('https://srcdex.dev//cmd//srcdex//'),
    );
    expect(got?.headers.get('Location'))
      .toBe('https://pkg.go.dev/srcdex.dev/cmd/srcdex');
  });

  it('redirects the bare module root to pkg.go.dev', () => {
    const got = router.fetch(newRequest('https://srcdex.dev/'));
    expect(got?.headers.get('Location'))
      .toBe('https://pkg.go.dev/srcdex.dev');
  });

  it('serves HEAD like GET', () => {
    const got = router.fetch(
      newRequest('https://srcdex.dev/?go-get=1', 'HEAD'),
    );
    expect(got?.status).toBe(200);
  });

  it('declines other methods', () => {
    const got = router.fetch(
      newRequest('https://srcdex.dev/?go-get=1', 'POST'),
    );
    expect(got).toBeUndefined();
  });

  it('declines unmatched paths even with go-get=1', () => {
    const scoped = newGoGetRouter({
      rules: [{ prefix: '/slog', repo: SRCDEX_REPO }],
    });
    const got = scoped.fetch(
      newRequest('https://srcdex.dev/other?go-get=1'),
    );
    expect(got).toBeUndefined();
  });

  it('prioritises go-get over file detection', async () => {
    const got = router.fetch(
      newRequest('https://srcdex.dev/README.md?go-get=1'),
    );
    expect(got?.status).toBe(200);
    const body = await got?.text();
    expect(body).toContain('go-import');
  });

  it('sends file paths elsewhere-hosted to pkg.go.dev', () => {
    const other = newGoGetRouter({
      rules: [{ prefix: '', repo: OTHER_REPO }],
    });
    const got =
      other.fetch(newRequest('https://srcdex.dev/main.go'));
    expect(got?.headers.get('Location'))
      .toBe('https://pkg.go.dev/srcdex.dev/main.go');
  });

  it('honours the host option over the request URL', async () => {
    const pinned = newGoGetRouter({
      rules: srcdexRules,
      host: 'srcdex.dev',
    });
    const got = pinned.fetch(
      newRequest('https://origin.example/?go-get=1'),
    );
    const body = await got?.text();
    expect(body).toContain('content="srcdex.dev git');
  });

  it('honours the redirectCode option', () => {
    const permanent = newGoGetRouter({
      rules: srcdexRules,
      redirectCode: 301,
    });
    const got =
      permanent.fetch(newRequest('https://srcdex.dev/cmd'));
    expect(got?.status).toBe(301);
  });

  it('honours the fileExtensions option', () => {
    const sums = newGoGetRouter({
      rules: srcdexRules,
      fileExtensions: ['.sum'],
    });
    const got =
      sums.fetch(newRequest('https://srcdex.dev/go.sum'));
    expect(got?.headers.get('Location'))
      .toBe(`${SRCDEX_REPO}/blob/main/go.sum`);
    const notFile =
      sums.fetch(newRequest('https://srcdex.dev/main.go'));
    expect(notFile?.headers.get('Location'))
      .toBe('https://pkg.go.dev/srcdex.dev/main.go');
  });

  it('honours the ref option in blob redirects', () => {
    const master = newGoGetRouter({
      rules: [{ prefix: '', repo: SRCDEX_REPO, ref: 'master' }],
    });
    const got =
      master.fetch(newRequest('https://srcdex.dev/main.go'));
    expect(got?.headers.get('Location'))
      .toBe(`${SRCDEX_REPO}/blob/master/main.go`);
  });

  it('honours ruleDefaults for rules without overrides', () => {
    const master = newGoGetRouter({
      rules: srcdexRules,
      ruleDefaults: { ref: 'master' },
    });
    const got =
      master.fetch(newRequest('https://srcdex.dev/main.go'));
    expect(got?.headers.get('Location'))
      .toBe(`${SRCDEX_REPO}/blob/master/main.go`);
  });

  it('declines excluded subtrees even with go-get=1', () => {
    // kagal.dev is hybrid: Go modules at the repository root,
    // TypeScript packages under /packages handled downstream.
    const kagal = newGoGetRouter({
      rules: [
        { prefix: '/packages', exclude: true },
        { prefix: '', repo: KAGAL_REPO },
      ],
    });
    const got = kagal.fetch(
      newRequest('https://kagal.dev/packages/tsdoc?go-get=1'),
    );
    expect(got).toBeUndefined();
    expect(kagal.resolve(
      new URL('https://kagal.dev/packages/tsdoc'),
    )).toBeUndefined();
    const kept =
      kagal.fetch(newRequest('https://kagal.dev/cmd'));
    expect(kept?.headers.get('Location'))
      .toBe('https://pkg.go.dev/kagal.dev/cmd');
  });
});

describe('GoGetRouter.fetch (repository routes)', () => {
  const router = newGoGetRouter({
    rules: [
      { prefix: '/x', repo: X_REPO, module: false },
      { prefix: '/{repo}', repo: TEMPLATE },
    ],
  });

  it('redirects the bare repository root to the repository',
    () => {
      const got =
        router.fetch(newRequest('https://darvaza.org/x'));
      expect(got?.status).toBe(302);
      expect(got?.headers.get('Location')).toBe(X_REPO);
    });

  it('answers go-get on the bare root for prefix verification',
    async () => {
      const got = router.fetch(
        newRequest('https://darvaza.org/x?go-get=1'),
      );
      expect(got?.status).toBe(200);
      const body = await got?.text();
      expect(body).toContain(
        `content="darvaza.org/x git ${X_REPO}"`,
      );
    });

  it('serves the same root in go-get meta tags below the root',
    async () => {
      const got = router.fetch(
        newRequest('https://darvaza.org/x/web?go-get=1'),
      );
      expect(got?.status).toBe(200);
      const body = await got?.text();
      expect(body).toContain(
        `content="darvaza.org/x git ${X_REPO}"`,
      );
    });

  it('routes modules below the root to pkg.go.dev', () => {
    const got =
      router.fetch(newRequest('https://darvaza.org/x/web'));
    expect(got?.headers.get('Location'))
      .toBe('https://pkg.go.dev/darvaza.org/x/web');
  });

  it('redirects files below the root to the blob view', () => {
    const got = router.fetch(
      newRequest('https://darvaza.org/x/README.md'),
    );
    expect(got?.headers.get('Location'))
      .toBe(`${X_REPO}/blob/main/README.md`);
  });

  it('keeps captured module roots on pkg.go.dev',
    () => {
      const got =
        router.fetch(newRequest('https://darvaza.org/slog'));
      expect(got?.headers.get('Location'))
        .toBe('https://pkg.go.dev/darvaza.org/slog');
    });
});

describe('GoGetRouter resolve dump', () => {
  const dumping =
    newGoGetRouter({ rules: srcdexRules, resolve: true });

  it('answers ?resolve=1 with the JSON resolution', async () => {
    const got = dumping.fetch(
      newRequest('https://srcdex.dev/cmd?resolve=1'),
    );
    expect(got?.status).toBe(200);
    expect(await got?.json()).toEqual({
      match: {
        captures: {},
        repo: SRCDEX_REPO,
        rootPath: '',
        subPath: 'cmd',
        rule: {
          prefix: '',
          repo: SRCDEX_REPO,
          vcs: 'git',
          ref: 'main',
          module: true,
        },
      },
    });
  });

  it('answers ?resolve=1 with {} for unclaimed paths', async () => {
    const scoped = newGoGetRouter({
      rules: [{ prefix: '/slog', repo: SRCDEX_REPO }],
      resolve: true,
    });
    const got = scoped.fetch(
      newRequest('https://srcdex.dev/other?resolve=1'),
    );
    expect(got?.status).toBe(200);
    expect(await got?.json()).toEqual({});
  });

  it('routes ?resolve=1 normally when resolve is off', () => {
    const off = newGoGetRouter({ rules: srcdexRules });
    const got = off.fetch(
      newRequest('https://srcdex.dev/cmd?resolve=1'),
    );
    expect(got?.status).toBe(302);
    expect(got?.headers.get('Location'))
      .toBe('https://pkg.go.dev/srcdex.dev/cmd');
  });
});

describe('GoGetRouter logger', () => {
  it('hands the URL and match to the logger', () => {
    let loggedURL: undefined | URL;
    let loggedMatch: RuleMatch | undefined;
    const router = newGoGetRouter({
      rules: srcdexRules,
      logger: (url, match) => {
        loggedURL = url;
        loggedMatch = match;
      },
    });
    router.fetch(newRequest('https://srcdex.dev/cmd/srcdex'));
    expect(loggedURL?.pathname).toBe('/cmd/srcdex');
    expect(loggedMatch).toMatchObject({
      repo: SRCDEX_REPO,
      rootPath: '',
      subPath: 'cmd/srcdex',
    });
  });

  it('passes an undefined match for declined paths', () => {
    let called = false;
    let loggedMatch: RuleMatch | undefined;
    const scoped = newGoGetRouter({
      rules: [{ prefix: '/slog', repo: SRCDEX_REPO }],
      logger: (_url, match) => {
        called = true;
        loggedMatch = match;
      },
    });
    scoped.fetch(newRequest('https://srcdex.dev/other'));
    expect(called).toBe(true);
    expect(loggedMatch).toBeUndefined();
  });

  it('hands an async logger promise to ctx.waitUntil', async () => {
    let waited: Promise<unknown> | undefined;
    const ctx: ExecutionContextLike = {
      waitUntil: (promise) => {
        waited = promise;
      },
    };
    let logged = false;
    const router = newGoGetRouter({
      rules: srcdexRules,
      logger: async () => {
        await Promise.resolve();
        logged = true;
      },
    });
    router.fetch(newRequest('https://srcdex.dev/cmd'), ctx);
    expect(waited).toBeInstanceOf(Promise);
    await waited;
    expect(logged).toBe(true);
  });

  it('leaves waitUntil untouched for a synchronous logger', () => {
    let waitCalls = 0;
    let logCalls = 0;
    const ctx: ExecutionContextLike = {
      waitUntil: () => {
        waitCalls += 1;
      },
    };
    const router = newGoGetRouter({
      rules: srcdexRules,
      logger: () => {
        logCalls += 1;
      },
    });
    router.fetch(newRequest('https://srcdex.dev/cmd'), ctx);
    expect(logCalls).toBe(1);
    expect(waitCalls).toBe(0);
  });

  it('tolerates an async logger with no context', () => {
    const router = newGoGetRouter({
      rules: srcdexRules,
      logger: () => Promise.resolve(),
    });
    expect(() =>
      router.fetch(newRequest('https://srcdex.dev/cmd'))).not.toThrow();
  });
});
