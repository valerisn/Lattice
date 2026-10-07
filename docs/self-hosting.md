# Self-hosting

Use Docker Compose v2 and budget at least 2 GB RAM for a small installation; builds may need additional memory. Generate `.env` with `node scripts/configure.mjs` or fill in `.env.example` manually with random credentials. Use a hex database password because Compose embeds it in a connection URL.

Set `APP_URL` to the exact browser-facing origin. Public installations should use HTTPS through a reverse proxy forwarding to `127.0.0.1:3000`. Preserve the original host. Then run:

```sh
docker compose up -d --build
docker compose ps
```

The app runs as the non-root `node` user and waits for PostgreSQL health. Migrations apply automatically. Open the configured URL, enter `SETUP_TOKEN`, and create the owner. Setup closes after initialization.

Invite teammates through **Workspace settings → Members**. Share generated links yourself; Lattice does not send email yet.

The administration **Overview** shows page counts, drafts, empty pages, and recently updated documentation, with links to open each page. Counts reflect publication states; permissions and draft ancestors still determine visibility. The release checker is available here and under **System**.

Use **Workspace settings → Documentation** to choose the default publication state for new pages, reading width, table of contents, visible page metadata, and footer message. These preferences apply per workspace. Drafts stay hidden from viewers; authors can explicitly publish a page. Disabling author display is a presentation preference, not an access-control change.

Create reusable Markdown starting points under **Workspace settings → Templates**. Writers can choose a template in the new-page dialog. Templates are shared with all workspace writers, so keep restricted material in permission-controlled pages. Editing or deleting a template never changes pages already created from it.

## Persistence and backups

**Workspace settings → Audit log** records successful administrative changes from the time audit logging is installed. Entries retain the actor's display name, action, target label, and timestamp. Settings changes and their audit entries commit together. Only administrators can read this history. Page edits remain in page revision history; login attempts and collection changes are not yet included. Audit entries live in PostgreSQL and are retained with your database backups. There is currently no automatic retention limit.

Compose creates `postgres` and `uploads` named volumes. Both matter. `docker compose down` preserves them; adding `-v` deletes all stored content.

For a consistent small-instance backup, stop the app, dump PostgreSQL, archive uploads, and restart. POSIX shell example:

```sh
docker compose stop app
docker compose exec -T db pg_dump -U lattice -d lattice > lattice.sql
docker compose run --rm --no-deps --user root -v "${PWD}:/backup" --entrypoint tar app -czf /backup/lattice-uploads.tar.gz -C /app/uploads .
docker compose start app
```

On PowerShell, use version 7.4+ for native stream redirection or dump inside the container and copy the file out. Store backups away from the server and keep `.env` in a secure configuration backup.

Restore into an empty database using `psql -U lattice`, restore upload files into `/app/uploads`, and ensure files belong to the container's `node` user (UID 1000). Restart and verify a page and an attachment download.

## Upgrades

**Workspace settings → System → Check for updates** compares the installed package version with the latest stable GitHub release. Only administrators can check. Checks are manual, make one unauthenticated request to `api.github.com`, send no workspace or account data, and share a five-minute in-memory cache per server process. The cache clears on restart. A failed check does not mean the installation is up to date. Prereleases and unreleased commits are outside this check.

Back up database, uploads, and configuration. Read migration/release notes, pull the intended revision, and run `docker compose up -d --build`. Check health, login, editing, and downloads. Migrations have no automated downgrade runner; restore coordinated backups when rollback requires an earlier schema.

## Troubleshooting

- Setup unavailable: configure `SETUP_TOKEN` and restart.
- Origin rejected: match the scheme, hostname, and port in `APP_URL` exactly.
- Missing cookie: HTTPS `APP_URL` creates secure cookies; use HTTPS.
- Database not ready: inspect `docker compose logs db` without publishing credentials.
- Upload rejected: check file type and workspace size limits; SVG/HTML/executables/archives are unsupported.
- Conflicting save: download unsaved text, reload, and merge.
- Missing access: ancestor pages and collections can restrict a page; owners can inspect grants.

Deleting an attachment removes its file. Deleting an entire page currently may leave orphaned files. Retain them until a database-aware cleanup tool is available; do not delete files by guessed filenames.
