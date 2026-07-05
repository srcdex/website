import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import pkg from '../../package.json' with { type: 'json' };
import { VERSION } from '../index';

describe('VERSION (workerd pool)', () => {
  it('module loads under workerd', () => {
    expect(env).toBeDefined();
    expect(VERSION).toBe(pkg.version);
  });
});
