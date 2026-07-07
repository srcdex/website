# srcdex.dev website

Slim Cloudflare Worker dispatcher for the srcdex.dev Go vanity-import
domain, plus the reusable middleware behind it.

- [`@srcdex/go-get-import`](packages/@srcdex-go-get-import) —
  Cloudflare Workers middleware for Go vanity-import domains: answers
  `?go-get=1` with `go-import`/`go-source` meta tags, redirects file
  references (`.go`, `.md`) to the repository blob view, and everything
  else to [pkg.go.dev](https://pkg.go.dev).
- `apps/worker` — the private Worker serving <https://srcdex.dev>,
  mapping the bare `srcdex.dev` module to
  [srcdex/srcdex](https://github.com/srcdex/srcdex).

## Development

```sh
pnpm install
pnpm precommit   # dev:prepare + lint + type-check + build + test
pnpm dev         # wrangler dev for the worker
```
