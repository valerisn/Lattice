# Contributing to Lattice

Favor small, complete improvements. Use Node.js 24 LTS, run `npm ci`, then `npm run dev`. Development works without Docker using PGlite. Open `http://localhost:3000` and create a development workspace.

Before a pull request, run `npm run check`. Run `npm run build` for application changes. For browser workflows, install Chromium using `npx playwright install chromium`, stop the dev server, and run `npm run test:e2e`.

Use a disposable database for tests. Browser tests with `DATABASE_URL` require an empty PostgreSQL database. Service tests use isolated in-memory databases.

## Working agreements

- Keep commits focused and explain the resulting behavior in the pull request.
- Record visible behavior changes under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).
- Validate external input, parameterize queries, and authorize every server operation.
- Keep transactions in services; avoid filesystem/network calls inside database transactions.
- Add migrations rather than changing already-released ones.
- Test permission boundaries, data integrity, and regressions.
- Include loading, empty, failure, and permission-denied states.
- Check labels, keyboard behavior, and phone layouts.
- Comment on non-obvious decisions; let names explain routine code.
- Never commit credentials, `.env`, local databases, or uploads.

## Layout

| Directory        | Responsibility                                             |
| ---------------- | ---------------------------------------------------------- |
| `src/app`        | Routes, handlers, and styles                               |
| `src/components` | UI and editor                                              |
| `src/server`     | Authentication, authorization, services, database, storage |
| `src/shared`     | Client-safe types and role helpers                         |
| `migrations`     | Ordered SQL migrations                                     |
| `tests`          | Service and browser tests                                  |
| `docs`           | Deployment, architecture, API                              |

Run `npm run format` for formatting. Contributions follow the repository's AGPL-3.0-only license.
