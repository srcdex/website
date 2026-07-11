/**
 * Rule vocabulary and routing contracts shared by both layers
 * of the middleware: the path router (`newGoGetRouter`) and
 * the host router (`newGoGetHostRouter`).
 */

/** Fields common to every rule variant. */
export interface RuleBase {
  /**
   * Whether the import root itself is a module. `false` marks
   * roots such as monorepos whose modules live in
   * subdirectories (e.g. `darvaza.org/x/{foo}`); their bare
   * root sends human visitors to the repository, as pkg.go.dev
   * has no page for it. Default `true`.
   */
  readonly module?: boolean
  /**
   * Path prefix owned by the rule, matched at segment
   * boundaries. `''` (the default) matches the whole host.
   * Segments of the form `{name}` or `{name:pattern}` capture
   * one whole path segment each (see {@link RepoRule.repo}).
   */
  readonly prefix?: string
  /**
   * Branch or tag used for go-source links and file
   * redirects. Default `'main'`.
   */
  readonly ref?: string
  /**
   * Version control system announced in the go-import meta
   * tag. Default `'git'`.
   */
  readonly vcs?: string
}

/** Rule mapping its prefix to a repository. */
export interface RepoRule extends RuleBase {
  /**
   * Repository URL, e.g. `https://github.com/srcdex/srcdex`.
   * `{name}` placeholders expand from the prefix capture of
   * the same name; unbound placeholders fail compilation.
   */
  readonly repo: string
}

/**
 * Rule punching a hole in the table's coverage: when its
 * prefix matches, the table answers that there is no match,
 * so a downstream handler can claim the path (e.g. TypeScript
 * packages under `/packages` on a Go vanity host). Rules
 * placed before the exclusion keep matching their paths;
 * prefix captures act as constraints only.
 */
export interface ExcludeRule {
  /** Marks the rule as an exclusion. */
  readonly exclude: true
  /**
   * Path prefix declined by the table, matched at segment
   * boundaries. `''` (the default) declines the whole host.
   */
  readonly prefix?: string
}

/**
 * A vanity-import rule, discriminated by field presence.
 * Tables are ordered; the first matching rule wins, and a
 * matching {@link ExcludeRule} declines the whole table.
 */
export type Rule = ExcludeRule | RepoRule;

/**
 * Table-wide defaults for rule fields, applied when a rule
 * omits them; per-rule fields win over these, and these win
 * over the built-in defaults.
 */
export type RuleDefaults = Omit<RuleBase, 'prefix'>;

/**
 * {@link RuleBase} with every field materialised by
 * `compileRule`: prefix normalised, defaults resolved.
 */
export interface CompiledRuleBase {
  /** Whether the import root itself is a module. */
  readonly module: boolean
  /** Normalised path prefix owned by the rule. */
  readonly prefix: string
  /** Effective branch or tag. */
  readonly ref: string
  /** Effective version control system. */
  readonly vcs: string
}

/** Compiled {@link RepoRule}. */
export interface CompiledRepoRule extends CompiledRuleBase {
  /** Repository URL, possibly with `{name}` placeholders. */
  readonly repo: string
}

/** Compiled {@link ExcludeRule}: prefix normalised. */
export interface CompiledExcludeRule {
  /** Marks the rule as an exclusion. */
  readonly exclude: true
  /** Normalised path prefix declined by the table. */
  readonly prefix: string
}

/**
 * A rule with defaults materialised, as held in a router's
 * compiled table.
 */
export type CompiledRule =
  CompiledExcludeRule | CompiledRepoRule;

/** HTTP status codes accepted for redirect responses. */
export type RedirectCode = 301 | 302 | 303 | 307 | 308;

/**
 * Minimal execution-context shape the router uses to hand an
 * async logger's promise to background work — structurally
 * satisfied by a Cloudflare `ExecutionContext`, so the
 * middleware pulls in no Workers types of its own.
 */
export interface ExecutionContextLike {
  readonly waitUntil: (promise: Promise<unknown>) => void
}

/**
 * Fetch contract of {@link GoGetRouter}: `undefined` declines
 * the request so the caller can fall through to other
 * handlers. The optional execution context receives an async
 * {@link GoGetLogger}'s promise via `waitUntil`.
 */
export type GoGetImportHandler =
  (request: Request, ctx?: ExecutionContextLike)
  => Response | undefined;

/**
 * Verbose logger for the router: handed each request's URL and
 * its resolution (`undefined` when the path is unclaimed) to
 * record however it sees fit. May be asynchronous — the router
 * hands the returned promise to the execution context's
 * `waitUntil` when one is supplied. See {@link newConsoleLogger}
 * for a reference implementation.
 */
export type GoGetLogger =
  (url: URL, match: RuleMatch | undefined) => Promise<void> | void;

/**
 * Console-shaped logging sink accepted by
 * {@link newConsoleLogger}: satisfied by the global `console`
 * and by drop-in loggers such as consola.
 */
export interface ConsoleLike {
  readonly debug: (...arguments_: readonly unknown[]) => void
  readonly info: (...arguments_: readonly unknown[]) => void
}

/** Behaviour knobs shared by both layers. */
export interface GoGetImportSettings {
  /**
   * Extensions redirected to the repository blob view.
   * Default `['.go', '.md']`.
   */
  readonly fileExtensions?: readonly string[]
  /** Status code for redirect responses. Default `302`. */
  readonly redirectCode?: RedirectCode
  /**
   * Table-wide defaults for rule fields (`vcs`, `ref`,
   * `module`); per-rule fields win.
   */
  readonly ruleDefaults?: RuleDefaults

  /**
   * Optional verbose logger, handed the request URL and its
   * resolution (`undefined` when the path is unclaimed) once
   * per handled request, to record however it sees fit. A
   * development aid; omit in production.
   */
  readonly logger?: GoGetLogger
  /**
   * When `true`, the router answers `?resolve=1` with the JSON
   * resolution of the URL (`{ match }`, or `{}` when the path
   * is unclaimed) instead of routing it — a development aid
   * that exposes the compiled rule table. Default `false`;
   * leave it off in production.
   */
  readonly resolve?: boolean
}

/**
 * Settings for the host router ({@link GoGetHostRules} via
 * `newGoGetHostRouter`), adding the host-selection knob the
 * path router has no use for.
 */
export interface GoGetHostSettings extends GoGetImportSettings {
  /**
   * Request header naming the hostname to route as, in place of
   * the request's own host: when set, the host router reads this
   * header and, if the request carries it, selects the rule
   * table — and so the import host — by its value. A development
   * aid for reaching a table through a host that cannot present
   * the real name, such as a workers.dev preview whose Host the
   * platform pins to the TLS SNI. The caller owns the name and
   * whether to set it; omit in production as a matter of
   * hygiene, not safety — an override only reselects among the
   * router's own tables (an unknown host still declines), and
   * every table serves the same public meta document the real
   * host would, so a forged header gains nothing.
   */
  readonly hostHeader?: string
}

/** Options for the path router. */
export interface GoGetImportOptions extends GoGetImportSettings {
  /**
   * Host used to build import paths. Default: the hostname of
   * each request's URL.
   */
  readonly host?: string
  /** Ordered rule table; the first matching rule wins. */
  readonly rules: readonly Rule[]
}

/**
 * Rule tables keyed by hostname for the host router. Keys are
 * matched case-insensitively against request hostnames but are
 * used verbatim as the import host; two keys that differ only in
 * case are rejected at construction rather than one silently
 * shadowing the other.
 */
export type GoGetHostRules =
  Readonly<Record<string, readonly Rule[]>>;

/**
 * Resolution of a request path against a compiled rule table.
 * Effective settings (`vcs`, `ref`, `module`) live on the
 * compiled rule; the match itself carries only the per-request
 * routing output.
 */
export interface RuleMatch {
  /** Segments captured by the rule prefix, by capture name. */
  readonly captures: Readonly<Record<string, string>>
  /** Repository URL with placeholders expanded. */
  readonly repo: string
  /** Path of the module root below the host: `''` or `/slog`. */
  readonly rootPath: string
  /** The compiled rule that matched. */
  readonly rule: CompiledRepoRule
  /** Remainder below the module root, without leading `/`. */
  readonly subPath: string
}

/**
 * The routing surface both layers implement: the path router
 * (`newGoGetRouter`) and the host router
 * (`newGoGetHostRouter`), so a router of routers composes.
 */
export interface GoGetRouter {
  /**
   * Fetch-shaped entry point; `undefined` declines the
   * request so the caller can fall through.
   */
  readonly fetch: GoGetImportHandler
  /**
   * Resolves a URL against the route table without producing
   * a response; `undefined` when no route claims it.
   */
  readonly resolve: (url: URL) => RuleMatch | undefined
}
