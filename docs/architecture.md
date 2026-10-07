# Architecture

Lattice is a single Next.js application, PostgreSQL database, and local attachment directory. It does not require a queue, distributed cache, or separate API service.

## Requests and storage

Handlers validate origin/body size, authenticate sessions, resolve membership, and call services. Services validate input and authorize resources. Clients never decide whether an operation is allowed.

The database adapter provides parameterized queries and transactions. PostgreSQL uses a connection pool; local development uses PGlite. Migrations run in filename order under a database lock. SQL files currently contain semicolon-separated statements; stored procedures with internal semicolons require extending the runner.

Page writes lock workspace mutations, compare the client's integer version, and create an immutable revision in the same transaction. Stale writes return HTTP 409. Autosave serializes requests and lets authors download unsaved content after an error. Restoring creates a new revision.

## Permissions

| Role   | Default access                                           |
| ------ | -------------------------------------------------------- |
| Owner  | All content/settings and elevated membership management  |
| Admin  | All content/settings; manage editors/viewers             |
| Editor | Read/edit accessible content, create pages, upload files |
| Viewer | Read accessible published content                        |

The last owner cannot be removed or demoted. Admins cannot manage owners or other admins.

Grants are allowlists. A page with grants requires a matching member/group grant. A child must satisfy every ancestor restriction, its own grants, and collection restrictions, including ancestor collections. `edit` includes read; `read` does not include edit. Grants never elevate viewers into editors.

Restricted collections require grants and stay restricted after their last grant is removed. Removing the last grant from an ordinary page or collection restores inherited/default access. Owners/admins bypass resource restrictions to administer and recover access. Search, revisions, favorites, and attachments use the same authorization context.

## Editor and extension points

Pages store Markdown with sanitized HTML support. TipTap emits Markdown; the reader sanitizes parsed content before rendering. There is no realtime collaboration; version conflicts protect competing edits.

`StorageProvider` exposes put/get/remove operations. The local provider uses UUID keys, never user paths. `SearchProvider` returns permission-filtered results; future indexes must preserve filtering. Authentication functions remain separate from content services so future identity providers can connect to existing users.

The internal HTTP API reuses service methods. A future versioned public API can add token authentication without embedding database logic in clients. Workspace-scoped foreign keys protect parent/resource ownership; moving pages rejects cycles and updates sibling positions atomically.
