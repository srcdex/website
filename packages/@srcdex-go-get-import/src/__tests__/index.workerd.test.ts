import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import pkg from '../../package.json' with { type: 'json' };
import { newGoGetRouter, VERSION } from '../index';

describe('VERSION (workerd pool)', () => {
  it('module loads under workerd', () => {
    expect(env).toBeDefined();
    expect(VERSION).toBe(pkg.version);
  });
});

describe('newGoGetRouter (workerd pool)', () => {
  const router = newGoGetRouter({
    rules: [{ prefix: '', repo: 'https://github.com/srcdex/srcdex' }],
  });

  it('answers go-get requests under workerd', async () => {
    const got = router.fetch(
      new Request('https://srcdex.dev/?go-get=1'),
    );
    expect(got?.status).toBe(200);
    const body = await got?.text();
    expect(body).toContain('<meta name="go-import"');
  });

  it('declines unrelated requests under workerd', () => {
    const got = router.fetch(
      new Request('https://srcdex.dev/', { method: 'POST' }),
    );
    expect(got).toBeUndefined();
  });
});
