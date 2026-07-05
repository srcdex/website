# @srcdex/go-get-import

Go vanity-import middleware for Fetch-API runtimes such
as Cloudflare Workers. It answers `?go-get=1` requests
with `go-import` / `go-source` meta tags, redirects
file paths (`.go`, `.md`) to the GitHub blob view, and
sends everything else to pkg.go.dev — driven by a
static, ordered rule table and free of runtime
dependencies.

The middleware itself is not implemented yet; the
package currently exports only `VERSION`. The API and
usage examples arrive with the implementation.

## Licence

MIT. See [LICENCE.txt](LICENCE.txt).
