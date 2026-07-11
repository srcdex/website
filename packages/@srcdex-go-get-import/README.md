# @srcdex/go-get-import

Go vanity-import middleware for Fetch-API runtimes such
as Cloudflare Workers. It answers `?go-get=1` requests
with `go-import` / `go-source` meta tags, redirects
file paths (`.go`, `.md`) to the GitHub blob view, and
sends everything else to pkg.go.dev — driven by a
static, ordered rule table and free of runtime
dependencies.

## Two routers

The package is modelled as a router of routers;
consumers pick the layer matching how they route hosts:

- **Layer 1 — path router**: `newGoGetRouter(options)`
  routes one ordered rule table. The host is pinned via
  `options.host` or taken from each request's URL. This
  is the layer a host-routing dispatcher mounts per
  hostname.
- **Layer 2 — host router**:
  `newGoGetHostRouter(hosts, settings?)` keys rule
  tables by hostname and builds one path router per
  entry. This is the standalone multi-domain worker
  shape.

Both implement the same interface:

```ts
interface GoGetRouter {
  resolve(url: URL): RuleMatch | undefined;
  fetch(request: Request, ctx?: ExecutionContextLike):
    Response | undefined;
}
```

`resolve` answers "would you claim this?" without
producing a response. `fetch` declines with
`undefined` — non-GET/HEAD methods, unmatched paths,
unknown hostnames — so callers can fall through to a
404 or to other middleware. Its optional `ctx` takes
the runtime's execution context; pass it so an
asynchronous logger's tail can settle under
`waitUntil` (see Development aids).

## Rules

A rule owns a path `prefix` (matched at segment
boundaries; `''`, the default, owns the whole host) and
maps it to a repository:

```ts
// Fixed repository:
{ prefix: '', repo: 'https://github.com/srcdex/srcdex' }
```

A prefix segment written `{name}` is a capture: it
matches one whole path segment and expands the `{name}`
placeholder in the repository URL:

```ts
// darvaza.org/slog → github.com/darvaza-proxy/slog:
{ prefix: '/{repo}',
  repo: 'https://github.com/darvaza-proxy/{repo}' }
```

A capture consumes exactly one non-empty segment. Bare
`{name}` also declines `.`, `..` and file-like segments
(see `fileExtensions`), so a path such as `/README.md`
falls through to later rules; `{name:pattern}` instead
constrains the segment to the anchored regular
expression `pattern` (which cannot contain `/`) and
nothing else:

```ts
{ prefix: '/{repo:[a-z][a-z0-9]*}',
  repo: 'https://github.com/darvaza-proxy/{repo}' }
```

A third variant carves a subtree out of the table — the
route matches, and its action is to decline, so the path
falls through to whatever the caller mounts next. This
serves hybrid repositories such as `kagal-dev/kagal`,
with Go modules at the root and TypeScript packages
under `/packages` handled downstream:

```ts
// Excluded subtree, handled downstream:
{ prefix: '/packages', exclude: true }
```

Tables are ordered and the first matching rule wins. A
rule whose prefix declines the path — a literal
mismatch, or a capture without an acceptable segment —
falls through to later rules. An exclusion punches a
hole in the table's coverage: where it matches, the
table answers that there is no match. Rules placed
before the exclusion are unaffected and keep claiming
their paths:

```ts
{ prefix: '/packages/go', repo: '…' },   // still matched
{ prefix: '/packages', exclude: true },  // no match here
```

Exclusion prefixes take captures too, purely as
constraints — there is no repository URL to expand them
into. Capture semantics do not change: a bare `{name}`
still declines file-like segments and therefore does not
exclude them; constrain with a pattern (e.g. `{name:.*}`)
to exclude every segment.

Two caveats. Order matters: the hole is punched before
the coverage it cuts out, and re-inclusions come before
the hole — `compileRules` rejects tables where a rule
can never be reached because an earlier capture-free
rule owns its whole prefix. That check is deliberately
narrow: it fires only behind capture-free prefixes, yet
a bare `{name}` still owns every ordinary segment, so a
literal rule left unreachable behind an earlier capture
is not rejected. Order specific literals ahead of a
broad capture. And the hole exists at the
routing level only: an enclosing root's go-import meta
still claims the whole subtree, so the Go toolchain can
resolve modules through the hole via the repository
itself. Keep `go.mod` files out of excluded trees —
especially under `module: false` roots, whose meta
invites subdirectory-module lookups. Optional fields: `vcs`
(default `'git'`), `ref` (default `'main'`, used for
go-source links and blob redirects), and `module`
(default `true`; see below). Table-wide defaults for
those three go in `settings.ruleDefaults`; per-rule
fields win.

Rule tables are compiled at construction:
`compileRules` materialises defaults, normalises
prefixes and validates captures — malformed segments,
duplicate capture names and repository placeholders not
bound by a capture all throw. `resolve` reports matches
as `{ repo, rootPath, subPath, captures, rule }` with
the effective settings on the compiled `rule`.

### Repository roots that are not modules

`module: false` marks a root that references a
repository without being a module itself — a monorepo
whose modules live in subdirectories, such as
`darvaza.org/x/{foo}` in the `darvaza-proxy/x`
repository:

```ts
{ prefix: '/x',
  repo: 'https://github.com/darvaza-proxy/x',
  module: false }
```

Human visits to the bare root redirect to the
repository instead of pkg.go.dev, which has no page for
it, and the go-get page offers only the clone line
there — the root is not importable. `?go-get=1` still
serves the meta tags: when
the Go toolchain resolves `darvaza.org/x/web` it
re-fetches the declared root (`darvaza.org/x`) and
requires the same `go-import` meta, so the bare root
must keep answering.

## Request handling

For each GET/HEAD request, after normalising the path
(duplicate slashes collapsed, the trailing slash
stripped) and resolving the rule table:

1. No matching rule → decline (even with `?go-get=1`).
2. `?go-get=1` → `200 text/html` with the `go-import`
   meta tag, a `go-source` tag when the repository is
   GitHub-hosted and tracked with git, a friendly body,
   and a 5-second refresh to pkg.go.dev (to the
   repository on a bare `module: false` root). All
   interpolations are HTML-escaped.
3. The bare root of a `module: false` rule → `302` to
   the repository.
4. A path below the root ending in a file extension, on
   a GitHub repository → `302` to
   `{repo}/blob/{ref}/{subPath}`.
5. Anything else → `302` to
   `https://pkg.go.dev/{host}{path}`.

The redirect status is configurable via
`redirectCode`; the file extensions via
`fileExtensions`. Except for `module: false` roots,
modules are assumed to live at the matched root of the
repository.

## Usage

### Standalone worker (host router)

```ts
import { newGoGetHostRouter } from '@srcdex/go-get-import';

const goGet = newGoGetHostRouter({
  'srcdex.dev': [
    { prefix: '', repo: 'https://github.com/srcdex/srcdex' },
  ],
  'darvaza.org': [
    { prefix: '/x',
      repo: 'https://github.com/darvaza-proxy/x',
      module: false },
    { prefix: '/{repo}',
      repo: 'https://github.com/darvaza-proxy/{repo}' },
  ],
});

export default {
  fetch: (request: Request) =>
    goGet.fetch(request)
      ?? new Response('Not Found', { status: 404 }),
};
```

With the darvaza.org table above,
`darvaza.org/slog/handlers/discard` resolves to the
`darvaza-proxy/slog` repository with `handlers/discard`
as the path below the module root — nested modules need
no extra rules.

### Dispatcher mount (path router)

A dispatcher that already routes by hostname mounts one
path router per host and pins `host`:

```ts
import { newGoGetRouter } from '@srcdex/go-get-import';

const goGet = newGoGetRouter({
  host: 'srcdex.dev',
  rules: [
    { prefix: '', repo: 'https://github.com/srcdex/srcdex' },
  ],
});
```

Note for `@apptly/sass-dispatcher`: its `Handler` type
returns `Promise<Response> | Response`, while
`GoGetRouter.fetch` returns `Response | undefined`.
Wrap the decline case at the mount point —
`request => goGet.fetch(request) ?? notFound(request)`
— or cast if the surrounding routing guarantees a
match.

### Composition helpers

The pieces behind the path router are exported for
consumers with bespoke needs: `compileRule`,
`compileRules`, `matchPrefix`, `matchRules` and
`isFilePath` (rule compilation and path resolution),
`goImportMeta`, `goSourceMeta` and `goGetHTML`
(rendering, escaped via `escapeHTML`), plus
`isGitHubRepo` and `DEFAULT_FILE_EXTENSIONS`.

### Development aids

Three opt-in settings help while building a rule table,
all off by default and meant to stay off in production:

- `resolve: true` makes the router answer `?resolve=1`
  with the JSON resolution of the URL —
  `{ match: RuleMatch }`, or `{}` when no rule claims it
  — instead of routing the request. It exposes the
  compiled rule table, so enable it only behind the host
  application's own development signal.
- `logger` is handed each request's URL and its
  resolution (`undefined` when unclaimed) once per
  request, to record however it sees fit. The router
  invokes it synchronously, so a slow synchronous logger
  delays the response; if it returns a promise and the
  execution context is passed to `fetch`, the router
  hands that promise to `ctx.waitUntil`, so only the
  asynchronous tail runs after the response rather than
  before it.
- `hostHeader` (host router only) names a request header
  whose value overrides the routing host: when the
  request carries it, the host router selects the rule
  table — and so the import host — by that value instead
  of the request's own hostname. It reaches a table
  through a host that cannot present the real name, such
  as a workers.dev preview whose Host the platform pins to
  the TLS SNI. The caller owns the header name and whether
  to set it.

`newConsoleLogger(level, sink)` is a reference logger —
`info` (the default) logs a concise path-to-repository
line, `debug` logs the path with the full match. It
writes to the global `console` unless you pass a drop-in
such as consola.

```ts
const goGet = newGoGetHostRouter(hostRules, {
  resolve: dev,
  logger: dev ? newConsoleLogger('debug') : undefined,
});

export default {
  fetch: (request, env, ctx) => goGet.fetch(request, ctx) ??
    notFound(),
} satisfies ExportedHandler;
```

`dev` is the caller's own flag; the middleware reads no
environment of its own.

## Licence

MIT. See [LICENCE.txt](LICENCE.txt).
