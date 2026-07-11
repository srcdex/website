# Changelog

All notable changes to `@srcdex/go-get-import` will be
documented in this file.

## [Unreleased]

### Added

- Two-layer router API: `newGoGetRouter` (path router over
  one ordered rule table) and `newGoGetHostRouter` (host
  router dispatching to one path router per hostname); both
  implement `GoGetRouter` (`resolve` + `fetch`, where
  `undefined` declines).
- Rule model: `RepoRule` maps a path prefix to a repository
  URL. Prefix segments may be whole-segment captures —
  `{name}`, or `{name:pattern}` for an anchored regular
  expression — expanded into `{name}` placeholders in the
  URL. `ExcludeRule` carves a subtree out for downstream
  handlers. Tables are ordered, first match wins.
  `module: false` marks repository roots that are not
  modules themselves; their bare root redirects human
  visitors to the repository instead of pkg.go.dev.
- Rule tables are compiled at construction: `compileRule`/
  `compileRules` materialise defaults (table-wide overrides
  via `settings.ruleDefaults`), normalise prefixes, validate
  captures and reject unreachable rules; `RuleMatch` carries
  the compiled rule and the captured segments alongside
  `repo`/`rootPath`/`subPath`.
- Composition helpers: `matchPrefix`, `matchRules`,
  `isFilePath`, `goImportMeta`, `goSourceMeta`, `goGetHTML`,
  `escapeHTML`, `isGitHubRepo`.
- Development aids on the router factory, three in all and
  off by default: `resolve` answers `?resolve=1` with the
  JSON resolution of the URL, and `logger` receives each
  request's URL and match to record as it sees fit. The
  router invokes it synchronously; if it returns a promise
  and `fetch` is given an execution context, that promise
  is handed to `waitUntil`, so only its asynchronous tail
  runs after the response.
  `newConsoleLogger(level, sink)` is a reference logger
  over `console` or a drop-in such as consola. On the host
  router, `hostHeader` names a request header whose value
  overrides which table — and so which import host — a
  request routes to, for reaching a table through a host
  that cannot present its real name. The middleware reads
  no environment of its own.
