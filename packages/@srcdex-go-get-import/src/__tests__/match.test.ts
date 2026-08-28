// cspell:words slogx packagesx

import { describe, expect, it } from 'vitest';

import {
  type CompiledRule,
  compileRule,
  compileRules,
  isFilePath,
  matchPrefix,
  matchRules,
  type Rule,
  type RuleDefaults,
  type RuleMatch,
} from '../index';

const SRCDEX_REPO = 'https://github.com/srcdex/srcdex';
const KAGAL_REPO = 'https://github.com/kagal-dev/kagal';
const SLOG_REPO = 'https://github.com/darvaza-proxy/slog';
const X_REPO = 'https://github.com/darvaza-proxy/x';
const TEMPLATE = 'https://github.com/darvaza-proxy/{repo}';

interface MatchPrefixRow {
  readonly name: string
  readonly path: string
  readonly prefix: string
  readonly want: string | undefined
}

const matchPrefixRows: readonly MatchPrefixRow[] = [
  {
    name: 'empty prefix owns the root path',
    prefix: '',
    path: '',
    want: '',
  },
  {
    name: 'empty prefix owns every path',
    prefix: '',
    path: '/cmd/srcdex',
    want: 'cmd/srcdex',
  },
  {
    name: 'exact prefix match yields empty remainder',
    prefix: '/slog',
    path: '/slog',
    want: '',
  },
  {
    name: 'prefix match at segment boundary',
    prefix: '/slog',
    path: '/slog/handlers',
    want: 'handlers',
  },
  {
    name: 'no match inside a segment',
    prefix: '/slog',
    path: '/slogx',
    want: undefined,
  },
  {
    name: 'no match on a shorter path',
    prefix: '/slog',
    path: '/slo',
    want: undefined,
  },
  {
    name: 'prefix normalised: missing leading slash',
    prefix: 'slog',
    path: '/slog/x',
    want: 'x',
  },
  {
    name: 'prefix normalised: trailing slash stripped',
    prefix: '/slog/',
    path: '/slog/x',
    want: 'x',
  },
  {
    name: 'capture consumes one segment',
    prefix: '/{repo}',
    path: '/slog/x',
    want: 'x',
  },
  {
    name: 'capture matches a bare segment',
    prefix: '/{repo}',
    path: '/slog',
    want: '',
  },
  {
    name: 'capture declines the bare host',
    prefix: '/{repo}',
    path: '',
    want: undefined,
  },
  {
    name: 'capture declines an empty segment',
    prefix: '/{a}/{b}',
    path: '/x//y',
    want: undefined,
  },
  {
    name: 'capture declines the current-directory segment',
    prefix: '/{repo}',
    path: '/.',
    want: undefined,
  },
  {
    name: 'capture declines the parent-directory segment',
    prefix: '/{repo}',
    path: '/..',
    want: undefined,
  },
  {
    name: 'capture declines file-like segments',
    prefix: '/{repo}',
    path: '/README.md',
    want: undefined,
  },
];

describe('matchPrefix', () => {
  it.each(matchPrefixRows)('$name', ({ prefix, path, want }) => {
    expect(matchPrefix(prefix, path)).toBe(want);
  });
});

interface IsFilePathRow {
  readonly extensions: readonly string[] | undefined
  readonly name: string
  readonly path: string
  readonly want: boolean
}

const isFilePathRows: readonly IsFilePathRow[] = [
  {
    name: '.go file with default extensions',
    path: 'cmd/main.go',
    extensions: undefined,
    want: true,
  },
  {
    name: '.md file with default extensions',
    path: 'README.md',
    extensions: undefined,
    want: true,
  },
  {
    name: 'package path with default extensions',
    path: 'cmd/srcdex',
    extensions: undefined,
    want: false,
  },
  {
    name: 'custom extensions replace the defaults',
    path: 'cmd/main.go',
    extensions: ['.md'],
    want: false,
  },
  {
    name: 'custom extension matches',
    path: 'go.sum',
    extensions: ['.sum'],
    want: true,
  },
  {
    name: 'empty extension never matches',
    path: 'anything',
    extensions: [''],
    want: false,
  },
];

describe('isFilePath', () => {
  it.each(isFilePathRows)('$name', ({ path, extensions, want }) => {
    expect(isFilePath(path, extensions)).toBe(want);
  });
});

const repoRule: Rule = { prefix: '', repo: SRCDEX_REPO };
const segmentRule: Rule = { prefix: '/{repo}', repo: TEMPLATE };

interface CompileRuleRow {
  readonly defaults: RuleDefaults | undefined
  readonly name: string
  readonly rule: Rule
  readonly want: CompiledRule
}

const compileRuleRows: readonly CompileRuleRow[] = [
  {
    name: 'materialises the built-in defaults',
    rule: { repo: SRCDEX_REPO },
    defaults: undefined,
    want: {
      prefix: '',
      vcs: 'git',
      ref: 'main',
      module: true,
      repo: SRCDEX_REPO,
    },
  },
  {
    name: 'normalises the prefix',
    rule: { prefix: 'slog/', repo: SLOG_REPO },
    defaults: undefined,
    want: {
      prefix: '/slog',
      vcs: 'git',
      ref: 'main',
      module: true,
      repo: SLOG_REPO,
    },
  },
  {
    name: 'table defaults win over the built-ins',
    rule: segmentRule,
    defaults: { vcs: 'hg', ref: 'master', module: false },
    want: {
      prefix: '/{repo}',
      vcs: 'hg',
      ref: 'master',
      module: false,
      repo: TEMPLATE,
    },
  },
  {
    name: 'rule fields win over table defaults',
    rule: {
      prefix: '/x',
      repo: X_REPO,
      vcs: 'git',
      ref: 'main',
      module: false,
    },
    defaults: { vcs: 'hg', ref: 'master', module: true },
    want: {
      prefix: '/x',
      vcs: 'git',
      ref: 'main',
      module: false,
      repo: X_REPO,
    },
  },
  {
    name: 'compiles an exclusion with a normalised prefix',
    rule: { prefix: 'packages/', exclude: true },
    defaults: { ref: 'master' },
    want: { exclude: true, prefix: '/packages' },
  },
  {
    name: 'exclusion prefix defaults to the whole host',
    rule: { exclude: true },
    defaults: undefined,
    want: { exclude: true, prefix: '' },
  },
];

describe('compileRule', () => {
  it.each(compileRuleRows)('$name', ({ rule, defaults, want }) => {
    expect(compileRule(rule, defaults)).toEqual(want);
  });
});

interface CompileErrorRow {
  readonly error: string
  readonly name: string
  readonly rule: Rule
}

const compileErrorRows: readonly CompileErrorRow[] = [
  {
    name: 'rejects unbound repository placeholders',
    rule: { prefix: '', repo: TEMPLATE },
    error: 'unbound placeholder \'{repo}\'',
  },
  {
    name: 'rejects malformed capture segments',
    rule: { prefix: '/{repo', repo: SRCDEX_REPO },
    error: 'invalid prefix segment \'{repo\'',
  },
  {
    name: 'rejects empty prefix segments',
    rule: { prefix: '/a//b', repo: SRCDEX_REPO },
    error: 'invalid prefix segment \'\'',
  },
  {
    name: 'rejects duplicate capture names',
    rule: { prefix: '/{repo}/{repo}', repo: TEMPLATE },
    error: 'duplicate capture \'{repo}\'',
  },
  {
    name: 'rejects invalid capture patterns',
    rule: { prefix: '/{repo:[}', repo: TEMPLATE },
    error: 'Invalid regular expression',
  },
];

describe('compileRule validation', () => {
  it.each(compileErrorRows)('$name', ({ rule, error }) => {
    expect(() => compileRule(rule)).toThrow(error);
  });
});

interface CompileRulesErrorRow {
  readonly error: string
  readonly name: string
  readonly rules: readonly Rule[]
}

const compileRulesErrorRows: readonly CompileRulesErrorRow[] = [
  {
    name: 'rejects exclusions behind a broader rule',
    rules: [
      { prefix: '', repo: KAGAL_REPO },
      { prefix: '/packages', exclude: true },
    ],
    error: 'rule \'/packages\' is unreachable behind \'\'',
  },
  {
    name: 'rejects repo rules inside an exclusion hole',
    rules: [
      { prefix: '/packages', exclude: true },
      { prefix: '/packages/go', repo: KAGAL_REPO },
    ],
    error: 'rule \'/packages/go\' is unreachable behind \'/packages\'',
  },
  {
    name: 'rejects rules shadowed by a broader repo rule',
    rules: [
      { prefix: '', repo: SRCDEX_REPO },
      { prefix: '/slog', repo: SLOG_REPO },
    ],
    error: 'rule \'/slog\' is unreachable behind \'\'',
  },
];

describe('compileRules validation', () => {
  it.each(compileRulesErrorRows)('$name', ({ rules, error }) => {
    expect(() => compileRules(rules)).toThrow(error);
  });

  it('keeps rules after a capture rule reachable', () => {
    expect(() => compileRules([segmentRule, repoRule]))
      .not.toThrow();
  });
});

describe('compileRules', () => {
  it('compiles every rule with the shared defaults', () => {
    const got = compileRules(
      [segmentRule, repoRule],
      { ref: 'master' },
    );
    expect(got).toEqual([
      {
        prefix: '/{repo}',
        vcs: 'git',
        ref: 'master',
        module: true,
        repo: TEMPLATE,
      },
      {
        prefix: '',
        vcs: 'git',
        ref: 'master',
        module: true,
        repo: SRCDEX_REPO,
      },
    ]);
  });
});

interface MatchRulesRow {
  readonly name: string
  readonly path: string
  readonly rules: readonly Rule[]
  readonly want: Omit<RuleMatch, 'rule'> | undefined
}

const matchRulesRows: readonly MatchRulesRow[] = [
  {
    name: 'root repo rule matches the bare host',
    rules: [repoRule],
    path: '',
    want: {
      captures: {},
      repo: SRCDEX_REPO,
      rootPath: '',
      subPath: '',
    },
  },
  {
    name: 'omitted prefix defaults to the whole host',
    rules: [{ repo: SRCDEX_REPO }],
    path: '/cmd/srcdex',
    want: {
      captures: {},
      repo: SRCDEX_REPO,
      rootPath: '',
      subPath: 'cmd/srcdex',
    },
  },
  {
    name: 'root repo rule matches nested paths',
    rules: [repoRule],
    path: '/cmd/srcdex/main.go',
    want: {
      captures: {},
      repo: SRCDEX_REPO,
      rootPath: '',
      subPath: 'cmd/srcdex/main.go',
    },
  },
  {
    name: 'first matching rule wins',
    rules: [
      { prefix: '/slog', repo: SLOG_REPO },
      repoRule,
    ],
    path: '/slog/handlers',
    want: {
      captures: {},
      repo: SLOG_REPO,
      rootPath: '/slog',
      subPath: 'handlers',
    },
  },
  {
    name: 'non-matching prefix falls through to later rules',
    rules: [
      { prefix: '/slog', repo: SLOG_REPO },
      repoRule,
    ],
    path: '/slogx',
    want: {
      captures: {},
      repo: SRCDEX_REPO,
      rootPath: '',
      subPath: 'slogx',
    },
  },
  {
    name: 'capture expands into the repository URL',
    rules: [segmentRule],
    path: '/slog/handlers/discard',
    want: {
      captures: { repo: 'slog' },
      repo: SLOG_REPO,
      rootPath: '/slog',
      subPath: 'handlers/discard',
    },
  },
  {
    name: 'capture matches a bare segment',
    rules: [segmentRule],
    path: '/core',
    want: {
      captures: { repo: 'core' },
      repo: 'https://github.com/darvaza-proxy/core',
      rootPath: '/core',
      subPath: '',
    },
  },
  {
    name: 'capture declines the bare host',
    rules: [segmentRule],
    path: '',
    want: undefined,
  },
  {
    name: 'capture declines a file-like segment',
    rules: [segmentRule],
    path: '/README.md',
    want: undefined,
  },
  {
    name: 'declined capture falls through to later rules',
    rules: [segmentRule, repoRule],
    path: '/README.md',
    want: {
      captures: {},
      repo: SRCDEX_REPO,
      rootPath: '',
      subPath: 'README.md',
    },
  },
  {
    name: 'capture below a literal prefix',
    rules: [{ prefix: '/p/{repo}', repo: TEMPLATE }],
    path: '/p/slog/x',
    want: {
      captures: { repo: 'slog' },
      repo: SLOG_REPO,
      rootPath: '/p/slog',
      subPath: 'x',
    },
  },
  {
    name: 'multiple captures expand together',
    rules: [{
      prefix: '/gh/{owner}/{name}',
      repo: 'https://github.com/{owner}/{name}',
    }],
    path: '/gh/darvaza-proxy/slog/x',
    want: {
      captures: { owner: 'darvaza-proxy', name: 'slog' },
      repo: SLOG_REPO,
      rootPath: '/gh/darvaza-proxy/slog',
      subPath: 'x',
    },
  },
  {
    name: 'constrained capture matches its pattern',
    rules: [{ prefix: '/{repo:[a-z]+}', repo: TEMPLATE }],
    path: '/slog/x',
    want: {
      captures: { repo: 'slog' },
      repo: SLOG_REPO,
      rootPath: '/slog',
      subPath: 'x',
    },
  },
  {
    name: 'constrained capture declines other segments',
    rules: [{ prefix: '/{repo:[a-z]+}', repo: TEMPLATE }],
    path: '/Slog',
    want: undefined,
  },
  {
    name: 'declined constraint falls through to later rules',
    rules: [
      { prefix: '/{repo:[a-z]+}', repo: TEMPLATE },
      repoRule,
    ],
    path: '/9lives',
    want: {
      captures: {},
      repo: SRCDEX_REPO,
      rootPath: '',
      subPath: '9lives',
    },
  },
  {
    name: 'pattern overrides the file-like check',
    rules: [{
      prefix: String.raw`/{file:[\w.]+}`,
      repo: 'https://github.com/darvaza-proxy/{file}',
    }],
    path: '/README.md',
    want: {
      captures: { file: 'README.md' },
      repo: 'https://github.com/darvaza-proxy/README.md',
      rootPath: '/README.md',
      subPath: '',
    },
  },
  {
    name: 'non-module rule wins over a later capture',
    rules: [
      { prefix: '/x', repo: X_REPO, module: false },
      segmentRule,
    ],
    path: '/x',
    want: {
      captures: {},
      repo: X_REPO,
      rootPath: '/x',
      subPath: '',
    },
  },
  // kagal-dev/kagal is a hybrid repository: Go modules at the
  // root, TypeScript packages under /packages handled
  // downstream.
  {
    name: 'exclude rule declines its subtree',
    rules: [
      { prefix: '/packages', exclude: true },
      { prefix: '', repo: KAGAL_REPO },
    ],
    path: '/packages/tsdoc',
    want: undefined,
  },
  {
    name: 'exclude rule declines its bare prefix',
    rules: [
      { prefix: '/packages', exclude: true },
      { prefix: '', repo: KAGAL_REPO },
    ],
    path: '/packages',
    want: undefined,
  },
  {
    name: 'exclude rule does not leak onto siblings',
    rules: [
      { prefix: '/packages', exclude: true },
      { prefix: '', repo: KAGAL_REPO },
    ],
    path: '/packagesx',
    want: {
      captures: {},
      repo: KAGAL_REPO,
      rootPath: '',
      subPath: 'packagesx',
    },
  },
  {
    name: 'rules before the exclusion keep matching',
    rules: [
      { prefix: '/packages/go', repo: KAGAL_REPO },
      { prefix: '/packages', exclude: true },
      { prefix: '', repo: KAGAL_REPO },
    ],
    path: '/packages/go/mod',
    want: {
      captures: {},
      repo: KAGAL_REPO,
      rootPath: '/packages/go',
      subPath: 'mod',
    },
  },
  {
    name: 'the exclusion hole yields no match',
    rules: [
      { prefix: '/packages/go', repo: KAGAL_REPO },
      { prefix: '/packages', exclude: true },
      { prefix: '', repo: KAGAL_REPO },
    ],
    path: '/packages/tsdoc',
    want: undefined,
  },
  {
    name: 'exclusion captures constrain by pattern',
    rules: [
      { prefix: '/{pkg:.*-ts}', exclude: true },
      { prefix: '', repo: KAGAL_REPO },
    ],
    path: '/tsdoc-ts',
    want: undefined,
  },
  {
    name: 'non-matching exclusion pattern falls through',
    rules: [
      { prefix: '/{pkg:.*-ts}', exclude: true },
      { prefix: '', repo: KAGAL_REPO },
    ],
    path: '/tsdoc',
    want: {
      captures: {},
      repo: KAGAL_REPO,
      rootPath: '',
      subPath: 'tsdoc',
    },
  },
  {
    name: 'bare exclusion capture does not exclude file-like segments',
    rules: [
      { prefix: '/{pkg}', exclude: true },
      { prefix: '', repo: KAGAL_REPO },
    ],
    path: '/README.md',
    want: {
      captures: {},
      repo: KAGAL_REPO,
      rootPath: '',
      subPath: 'README.md',
    },
  },
  {
    name: 'no rules never matches',
    rules: [],
    path: '/x',
    want: undefined,
  },
];

describe('matchRules', () => {
  it.each(matchRulesRows)('$name', ({ rules, path, want }) => {
    const got = matchRules(compileRules(rules), path);
    if (want === undefined) {
      expect(got).toBeUndefined();
    } else {
      expect(got).toMatchObject(want);
      expect(got?.captures).toEqual(want.captures);
    }
  });

  it('reports the matching compiled rule', () => {
    const compiled = compileRules([segmentRule, repoRule]);
    const got = matchRules(compiled, '/slog');
    expect(got?.rule).toBe(compiled[0]);
  });

  it('carries the effective settings on the matched rule', () => {
    const compiled = compileRules([
      { prefix: '/x', repo: X_REPO, module: false },
    ], { ref: 'master' });
    const got = matchRules(compiled, '/x/web');
    expect(got?.rule).toMatchObject({
      vcs: 'git',
      ref: 'master',
      module: false,
    });
  });

  it('honours custom file extensions for capture segments', () => {
    const got = matchRules(
      compileRules([segmentRule]),
      '/README.md',
      ['.txt'],
    );
    expect(got).toMatchObject({
      repo: 'https://github.com/darvaza-proxy/README.md',
      rootPath: '/README.md',
      subPath: '',
    });
  });

  it('keeps unbound placeholders verbatim on hand-built rules',
    () => {
      const rules: readonly CompiledRule[] = [{
        prefix: '',
        vcs: 'git',
        ref: 'main',
        module: true,
        repo: 'https://example.com/{x}',
      }];
      const got = matchRules(rules, '/y');
      expect(got?.repo).toBe('https://example.com/{x}');
    });
});
