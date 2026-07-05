/**
 * Standalone compatibility smoke test — no test framework
 * required. Confirms the built dist loads on the current
 * Node version and that the public exports resolve to the
 * expected shapes. Behavioural coverage lives in the vitest
 * suite; this file's job is "did the dist boot at all".
 */

/* global console, process */
/* eslint unicorn/no-process-exit: "off" */

import { VERSION } from '../../dist/index.mjs';

let failures = 0;

function pass(name, detail) {
  console.log(`  ok ${name}${detail ? ' ' + detail : ''}`);
}

function fail(name, reason) {
  console.error(`  FAIL ${name}: ${reason}`);
  failures++;
}

function checkString(name, value) {
  if (typeof value === 'string') {
    pass(name, `= '${value}'`);
  } else {
    fail(name, `expected string, got ${typeof value}`);
  }
}

console.log(`Node ${process.version}`);
console.log(`@srcdex/go-get-import v${VERSION}`);

checkString('VERSION', VERSION);

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log(`\nok ${process.version} — all checks passed`);
}
