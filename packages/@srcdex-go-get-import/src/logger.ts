/**
 * Reference {@link GoGetLogger} for the router's development
 * logging: a factory over any console-shaped sink, defaulting
 * to the global `console`.
 */

import type { ConsoleLike, GoGetLogger } from './types';

/**
 * Builds a reference logger writing each request to a
 * console-shaped `sink` — the global `console` by default;
 * pass a drop-in such as consola to redirect it. The `info`
 * level logs a concise path-to-repository line (`(none)` when
 * the path is unclaimed); `debug` logs the path with the full
 * match, for inspecting captures and the compiled rule.
 */
export function newConsoleLogger(
  level: 'debug' | 'info' = 'info',
  sink: ConsoleLike = console,
): GoGetLogger {
  return (url, match) => level === 'debug' ?
    sink.debug(url.pathname, match) :
    sink.info(url.pathname, match?.repo ?? '(none)');
}
