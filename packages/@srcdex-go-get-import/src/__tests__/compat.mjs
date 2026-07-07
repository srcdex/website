/**
 * Standalone compatibility smoke test — no test framework
 * required. Confirms the built dist loads on the current
 * Node version and that the public exports resolve to the
 * expected shapes. Behavioural coverage lives in the vitest
 * suite; this file's job is "did the dist boot at all".
 */

/* global console, process */
/* eslint unicorn/no-process-exit: "off" */

import {
  compileRule,
  compileRules,
  DEFAULT_FILE_EXTENSIONS,
  escapeHTML,
  goGetHTML,
  goImportMeta,
  goSourceMeta,
  isFilePath,
  isGitHubRepo,
  matchPrefix,
  matchRules,
  newConsoleLogger,
  newGoGetHostRouter,
  newGoGetRouter,
  VERSION,
} from '../../dist/index.mjs';

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

function checkFunction(name, value) {
  if (typeof value === 'function') {
    pass(name, '(function)');
  } else {
    fail(name, `expected function, got ${typeof value}`);
  }
}

function checkArray(name, value) {
  if (Array.isArray(value)) {
    pass(name, `= [${value.join(', ')}]`);
  } else {
    fail(name, `expected array, got ${typeof value}`);
  }
}

console.log(`Node ${process.version}`);
console.log(`@srcdex/go-get-import v${VERSION}`);

checkString('VERSION', VERSION);
checkArray('DEFAULT_FILE_EXTENSIONS', DEFAULT_FILE_EXTENSIONS);
checkFunction('compileRule', compileRule);
checkFunction('compileRules', compileRules);
checkFunction('escapeHTML', escapeHTML);
checkFunction('goGetHTML', goGetHTML);
checkFunction('goImportMeta', goImportMeta);
checkFunction('goSourceMeta', goSourceMeta);
checkFunction('isFilePath', isFilePath);
checkFunction('isGitHubRepo', isGitHubRepo);
checkFunction('matchPrefix', matchPrefix);
checkFunction('matchRules', matchRules);
checkFunction('newConsoleLogger', newConsoleLogger);
checkFunction('newGoGetHostRouter', newGoGetHostRouter);
checkFunction('newGoGetRouter', newGoGetRouter);

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log(`\nok ${process.version} — all checks passed`);
}
