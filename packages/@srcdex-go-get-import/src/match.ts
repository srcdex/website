/**
 * Pure path-matching helpers behind the rule table: rule
 * compilation (defaults materialised, capture syntax
 * validated), prefix matching at segment boundaries with
 * whole-segment captures, file-path detection, and
 * first-match-wins rule resolution.
 */

import type {
  CompiledRepoRule,
  CompiledRule,
  Rule,
  RuleDefaults,
  RuleMatch,
} from './types';

/** Extensions treated as file paths unless overridden. */
export const DEFAULT_FILE_EXTENSIONS: readonly string[] =
  ['.go', '.md'];

/**
 * Normalises a rule prefix: trailing slashes stripped, a
 * leading slash ensured unless empty.
 */
function normalisePrefix(prefix: string): string {
  const p = prefix.replace(/\/+$/, '');
  if (p === '' || p.startsWith('/')) {
    return p;
  }
  return `/${p}`;
}

/**
 * Reports whether a path names a file, judged by its ending
 * against the given extensions.
 */
export function isFilePath(
  path: string,
  extensions: readonly string[] = DEFAULT_FILE_EXTENSIONS,
): boolean {
  return extensions.some((extension) =>
    extension !== '' && path.endsWith(extension));
}

/** Splits a relative path into its first segment and the rest. */
function splitSegment(path: string): [string, string] {
  const slash = path.indexOf('/');
  if (slash === -1) {
    return [path, ''];
  }
  return [path.slice(0, slash), path.slice(slash + 1)];
}

/** A prefix segment capturing one whole path segment. */
interface PrefixCapture {
  readonly name: string
  readonly pattern?: RegExp
}

/** A parsed prefix segment: a literal, or a capture. */
type PrefixPart = PrefixCapture | string;

const CAPTURE_SYNTAX = /^\{([A-Za-z_]\w*)(?::(.*))?\}$/;

function parseSegment(
  segment: string,
  prefix: string,
): PrefixPart {
  const capture = CAPTURE_SYNTAX.exec(segment);
  if (capture !== null) {
    // The capture-syntax regex mandates the name group.
    const name = capture[1]!;
    const pattern = capture[2];
    if (pattern === undefined) {
      return { name };
    }
    return { name, pattern: new RegExp(`^(?:${pattern})$`) };
  }
  if (segment === '' ||
    segment.includes('{') || segment.includes('}')) {
    throw new Error(
      `invalid prefix segment '${segment}' in '${prefix}'`);
  }
  return segment;
}

/** Parsed prefixes, cached by their normalised string. */
const parsedPrefixes = new Map<string, readonly PrefixPart[]>();

/**
 * Parses a normalised prefix into literal and capture
 * segments. Malformed or empty segments and duplicate capture
 * names throw; valid results are cached.
 */
function parsePrefix(prefix: string): readonly PrefixPart[] {
  const cached = parsedPrefixes.get(prefix);
  if (cached !== undefined) {
    return cached;
  }

  const parts = prefix === '' ?
    [] :
    prefix.slice(1).split('/')
      .map((segment) => parseSegment(segment, prefix));
  const names = new Set<string>();
  for (const part of parts) {
    if (typeof part === 'string') {
      continue;
    }
    if (names.has(part.name)) {
      throw new Error(
        `duplicate capture '{${part.name}}' in '${prefix}'`);
    }
    names.add(part.name);
  }

  parsedPrefixes.set(prefix, parts);
  return parts;
}

function captureMatches(
  capture: PrefixCapture,
  segment: string,
  fileExtensions?: readonly string[],
): boolean {
  if (capture.pattern !== undefined) {
    return capture.pattern.test(segment);
  }
  return segment !== '.' && segment !== '..' &&
    !isFilePath(segment, fileExtensions);
}

/** A successful prefix match: captures, root, remainder. */
interface PrefixMatch {
  readonly captures: Record<string, string>
  readonly rootPath: string
  readonly subPath: string
}

/**
 * Matches a path against parsed prefix parts, one segment per
 * part: literals must be equal; captures consume any
 * non-empty segment passing their check — the anchored
 * pattern when given, otherwise anything but `.`, `..` and
 * file-like segments.
 */
function matchParts(
  parts: readonly PrefixPart[],
  path: string,
  fileExtensions?: readonly string[],
): PrefixMatch | undefined {
  const captures: Record<string, string> = {};
  let rootPath = '';
  let rest = path.startsWith('/') ? path.slice(1) : path;

  for (const part of parts) {
    if (rest === '') {
      return undefined;
    }
    const [segment, next] = splitSegment(rest);
    if (typeof part === 'string') {
      if (segment !== part) {
        return undefined;
      }
    } else if (segment === '' ||
      !captureMatches(part, segment, fileExtensions)) {
      return undefined;
    } else {
      captures[part.name] = segment;
    }
    rootPath += `/${segment}`;
    rest = next;
  }

  return { captures, rootPath, subPath: rest };
}

/**
 * Matches a path against a rule prefix at segment boundaries,
 * returning the remainder without its leading slash, or
 * `undefined` when the prefix does not own the path. The
 * empty prefix owns every path; capture segments each consume
 * one path segment. Malformed capture syntax throws.
 */
export function matchPrefix(
  prefix: string,
  path: string,
  fileExtensions?: readonly string[],
): string | undefined {
  const parts = parsePrefix(normalisePrefix(prefix));
  return matchParts(parts, path, fileExtensions)?.subPath;
}

const REPO_PLACEHOLDER = /\{([A-Za-z_]\w*)\}/g;

/** Throws when a repo placeholder has no matching capture. */
function assertBoundPlaceholders(
  repo: string,
  parts: readonly PrefixPart[],
): void {
  const names = new Set<string>();
  for (const part of parts) {
    if (typeof part !== 'string') {
      names.add(part.name);
    }
  }
  for (const match of repo.matchAll(REPO_PLACEHOLDER)) {
    // The placeholder regex mandates the name group.
    const name = match[1]!;
    if (!names.has(name)) {
      throw new Error(
        `unbound placeholder '{${name}}' in '${repo}'`);
    }
  }
}

/**
 * Materialises a rule: prefix normalised and validated —
 * capture syntax, duplicate capture names, placeholder
 * binding all throw — and `vcs`/`ref`/`module` resolved:
 * per-rule fields win over the table defaults, which win
 * over the built-ins (`git`, `main`, `true`).
 */
export function compileRule(
  rule: Rule,
  defaults: RuleDefaults = {},
): CompiledRule {
  const prefix = normalisePrefix(rule.prefix ?? '');
  const parts = parsePrefix(prefix);
  if ('exclude' in rule) {
    return { exclude: true, prefix };
  }

  assertBoundPlaceholders(rule.repo, parts);
  return {
    prefix,
    vcs: rule.vcs ?? defaults.vcs ?? 'git',
    ref: rule.ref ?? defaults.ref ?? 'main',
    module: rule.module ?? defaults.module ?? true,
    repo: rule.repo,
  };
}

/** Reports whether every part is a literal segment. */
function isLiteralParts(parts: readonly PrefixPart[]): boolean {
  return parts.every((part) => typeof part === 'string');
}

/**
 * Compiles an ordered rule table with shared defaults.
 * Invalid rules throw (see {@link compileRule}), and so do
 * unreachable ones: a rule is rejected when an earlier
 * capture-free rule owns its whole prefix, matching or
 * declining every path before it is consulted.
 */
export function compileRules(
  rules: readonly Rule[],
  defaults?: RuleDefaults,
): readonly CompiledRule[] {
  const compiled =
    rules.map((rule) => compileRule(rule, defaults));

  // Prefixes of earlier rules that match unconditionally.
  const terminals: string[] = [];
  for (const rule of compiled) {
    const shadow = terminals.find((prefix) =>
      matchParts(parsePrefix(prefix), rule.prefix) !== undefined);
    if (shadow !== undefined) {
      throw new Error(
        `rule '${rule.prefix}' is unreachable behind '${shadow}'`);
    }
    if (isLiteralParts(parsePrefix(rule.prefix))) {
      terminals.push(rule.prefix);
    }
  }

  return compiled;
}

/**
 * Expands `{name}` placeholders from captured segments.
 * Unbound placeholders stay verbatim; compiled tables never
 * produce them (see {@link compileRule}), but hand-built
 * rules may.
 */
function expandRepo(
  repo: string,
  captures: Readonly<Record<string, string>>,
): string {
  return repo.replaceAll(REPO_PLACEHOLDER,
    (placeholder, name: string) => captures[name] ?? placeholder);
}

function matchRule(
  rule: CompiledRepoRule,
  path: string,
  fileExtensions?: readonly string[],
): RuleMatch | undefined {
  const match =
    matchParts(parsePrefix(rule.prefix), path, fileExtensions);
  if (match === undefined) {
    return undefined;
  }
  return {
    captures: match.captures,
    repo: expandRepo(rule.repo, match.captures),
    rootPath: match.rootPath,
    subPath: match.subPath,
    rule,
  };
}

/**
 * Resolves a request path against a compiled rule table (see
 * {@link compileRules}); the first matching rule wins. A rule
 * whose prefix declines the path — a literal mismatch, or a
 * capture without an acceptable segment — falls through to
 * later rules; a matching exclude rule declines the whole
 * table so a downstream handler can claim the path.
 */
export function matchRules(
  rules: readonly CompiledRule[],
  path: string,
  fileExtensions?: readonly string[],
): RuleMatch | undefined {
  for (const rule of rules) {
    if ('exclude' in rule) {
      const parts = parsePrefix(rule.prefix);
      if (matchParts(parts, path, fileExtensions) !== undefined) {
        return undefined;
      }
      continue;
    }
    const match = matchRule(rule, path, fileExtensions);
    if (match) {
      return match;
    }
  }
  return undefined;
}
