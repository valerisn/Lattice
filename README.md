<p align="center"><img src="public/lattice-logo.png" width="112" alt="Lattice logo"></p>

<h1 align="center">Lattice</h1>
<p align="center"><strong>Open knowledge, beautifully organized.</strong></p>
<p align="center"><a href="https://github.com/valerisn/Lattice/actions/workflows/ci.yml"><img src="https://github.com/valerisn/Lattice/actions/workflows/ci.yml/badge.svg" alt="Build and test status"></a> · <a href="LICENSE">AGPL-3.0</a></p>

A calm, connected home for your team's guides, notes, and decisions. Lattice is an open-source, self-hosted wiki with multiple workspaces, a rich editor, and permissions that stay on your server.

**Early alpha, version 0.1.0.** Core workflows are functional. Expect changes before a stable release. Keep backups, especially before upgrading.

![Lattice workspace](docs/images/workspace.png)

## What works today

- First-run setup, starter pages, and multiple workspaces
- Email/password accounts, invitation links, expiring sessions, and profiles
- Owner, admin, editor, and viewer roles; groups; inherited page/collection grants
- Nested pages, drag reordering, collections, favorites, drafts, and recent pages
- Rich text and Markdown, slash commands, tables, tasks, links, images, code, callouts, expandable sections, and teammate mention labels
- Autosave, conflict detection, immutable revisions, comparison, and restoration
- Permission-aware search with **Ctrl/Cmd + K**
- Incoming page links that respect workspace visibility
- Syntax highlighting, reliable heading navigation, and Markdown import/export
- Protected attachments, file validation, and local storage
- Light/dark/system appearance, branding, and workspace administration
- Documentation settings for publication defaults, reading layout, metadata, and footer text
- Reusable page templates with Markdown preview and protection against stale edits
- Administrator version checker for published stable releases
- Documentation overview with publication counts and draft/empty-page review lists
- Administrative audit history for settings, invitations, roles, groups, and access grants
- Docker Compose with PostgreSQL, health checks, and persistent volumes

Sharing copies a link; recipients still need workspace access. Mention labels do not send notifications. Drafts are visible to editors and administrators, but hidden from viewers. Anonymous publishing is not included.

See the [writing guide](docs/writing.md) for imports, templates, editing, and page organization.

## Run locally

Requirements: **Node.js 24 LTS** (minimum 22), npm, and Git.

```sh
git clone https://github.com/valerisn/Lattice.git
cd Lattice
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create your workspace. Without `DATABASE_URL`, development uses PGlite, an embedded PostgreSQL-compatible database, in `data/dev-db`. It supports a single local development process. No shared demo account ships with Lattice.

## Self-host with Docker

Requirements: Docker Engine and Docker Compose v2. Node.js is only needed for the optional configuration helper.

```sh
git clone https://github.com/valerisn/Lattice.git
cd Lattice
node scripts/configure.mjs
docker compose up -d --build
```

The helper generates `.env` with random database and setup credentials and refuses to overwrite existing configuration. Alternatively, copy `.env.example` to `.env` and set `POSTGRES_PASSWORD` and `SETUP_TOKEN` to long random values. Use a hex database password to avoid connection-URL encoding issues.

Open [http://localhost:3000](http://localhost:3000), enter the `SETUP_TOKEN` from `.env`, and create the owner account. Setup locks after initialization. Migrations run automatically under a database lock.

For a public installation, set `APP_URL` to the exact public HTTPS origin and put a TLS reverse proxy in front of `127.0.0.1:3000`. Compose binds the app to loopback and does not publish PostgreSQL. HTTPS enables secure session cookies.

See [deployment and backups](docs/self-hosting.md).

### Environment variables

| Variable            | Purpose                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | PostgreSQL connection string. Required in production; Compose sets it.                  |
| `APP_URL`           | Exact browser-facing origin. Required in production; used for CSRF and invitation URLs. |
| `SETUP_TOKEN`       | First-run setup credential. Required for production setup.                              |
| `POSTGRES_PASSWORD` | Compose database password. Required, with no default.                                   |
| `UPLOAD_DIR`        | Attachment directory. Defaults to `./uploads`; container uses `/app/uploads`.           |
| `DATA_DIR`          | Optional development PGlite directory.                                                  |
| `PORT`              | Production listening port, default `3000`.                                              |

Keep `.env`, databases, and uploads out of Git. The supplied ignore files cover them.

### Development with PostgreSQL

Run `node scripts/configure.mjs`, then `docker compose -f compose.dev.yaml up -d`. Add a `DATABASE_URL` to `.env` pointing to `localhost:5432`, database/user `lattice`, and the generated password. Then run `npm run dev`.

Next.js loads `.env`. For the migration CLI, export the variables or use `node --env-file=.env --import tsx scripts/migrate.ts`. Local PGlite data does not automatically transfer into a separate PostgreSQL database.

## Development and checks

```sh
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
```

`check` runs ESLint, TypeScript, and service/security tests. Stop any running dev server before browser tests. Without `DATABASE_URL`, browser tests use fresh `data/e2e-*` directories. With `DATABASE_URL`, they use the production build and expect a **fresh, disposable PostgreSQL database**. Never point tests at your real installation. CI also builds and starts the Docker stack.

## Architecture

Next.js App Router, React, strict TypeScript, PostgreSQL, and TipTap. Services use parameterized SQL, transactions, and versioned migrations. Explicit SQL keeps the schema compatible with both PostgreSQL and the local PGlite adapter. Search and storage have replaceable provider interfaces.

See [architecture and permission rules](docs/architecture.md) and [the internal API](docs/api.md).

## Current limits and planned work

- OAuth/SSO, LDAP/SAML, email delivery, and password-reset email
- Realtime collaboration, notifications, webhooks, and a plugin SDK
- S3 storage, external search indexes, background jobs, and pagination
- Anonymous publishing, public API tokens, rich media embeds, custom favicons, and richer audit logs
- The first release loads workspace pages for navigation/search; large installations need indexing and query tuning
- History shows the latest 100 revisions while the database retains all revisions; large comparisons fall back to side-by-side text
- Page deletion removes history and may leave orphaned attachment files; a file cleanup tool is planned

Planned integrations are clearly identified as unavailable in the interface.

## Contributing and license

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities through the process in [SECURITY.md](SECURITY.md).

Copyright © 2026 Lattice contributors. Licensed under **GNU Affero General Public License v3.0 only**. See [LICENSE](LICENSE). Network users of a modified version must have access to its corresponding source under the license's terms.
