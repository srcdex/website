import { afterEach, describe, expect, it, vi } from 'vitest';

import { newConsoleLogger, newGoGetRouter } from '../index';

const SRCDEX_REPO = 'https://github.com/srcdex/srcdex';
const url = new URL('https://srcdex.dev/cmd');
const match =
  newGoGetRouter({ rules: [{ prefix: '', repo: SRCDEX_REPO }] })
    .resolve(url);

describe('newConsoleLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a concise path-to-repository line at info', () => {
    const sink = { debug: vi.fn(), info: vi.fn() };
    newConsoleLogger('info', sink)(url, match);
    expect(sink.info).toHaveBeenCalledWith('/cmd', SRCDEX_REPO);
    expect(sink.debug).not.toHaveBeenCalled();
  });

  it('reports (none) for an unclaimed path at info', () => {
    const sink = { debug: vi.fn(), info: vi.fn() };
    newConsoleLogger('info', sink)(url, undefined);
    expect(sink.info).toHaveBeenCalledWith('/cmd', '(none)');
  });

  it('logs the path and full match at debug', () => {
    const sink = { debug: vi.fn(), info: vi.fn() };
    newConsoleLogger('debug', sink)(url, match);
    expect(sink.debug).toHaveBeenCalledWith('/cmd', match);
    expect(sink.info).not.toHaveBeenCalled();
  });

  it('defaults the level to info and the sink to console', () => {
    const info = vi.spyOn(console, 'info');
    newConsoleLogger()(url, match);
    expect(info).toHaveBeenCalledWith('/cmd', SRCDEX_REPO);
  });
});
