import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const SRCDEX_REPO = 'https://github.com/srcdex/srcdex';

function fetchManual(url: string): Promise<Response> {
  return SELF.fetch(url, { redirect: 'manual' });
}

describe('worker fetch (workerd pool)', () => {
  it('answers go-get on the srcdex.dev root', async () => {
    const response =
      await fetchManual('https://srcdex.dev/?go-get=1');

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain(
      `<meta name="go-import" content="srcdex.dev git ${SRCDEX_REPO}">`,
    );
    expect(body).toContain('<meta name="go-source"');
  });

  it('redirects file paths to the blob view', async () => {
    const response =
      await fetchManual('https://srcdex.dev/cmd/srcdex/main.go');

    expect(response.status).toBe(302);
    expect(response.headers.get('Location'))
      .toBe(`${SRCDEX_REPO}/blob/main/cmd/srcdex/main.go`);
  });

  it('redirects package paths to pkg.go.dev', async () => {
    const response =
      await fetchManual('https://srcdex.dev/cmd/srcdex');

    expect(response.status).toBe(302);
    expect(response.headers.get('Location'))
      .toBe('https://pkg.go.dev/srcdex.dev/cmd/srcdex');
  });

  it('serves unknown hostnames a 404', async () => {
    const response = await fetchManual('https://other.example/');

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('not found\n');
  });

  // The worker wires the resolve dump on via `debugResolver`.
  it('dumps the translation with ?resolve=1', async () => {
    const response =
      await fetchManual('https://srcdex.dev/cmd?resolve=1');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
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
});
