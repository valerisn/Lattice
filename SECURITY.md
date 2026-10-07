# Security

Lattice 0.1 is an early alpha. The main branch receives fixes during initial development.

Report vulnerabilities through [private vulnerability reporting](https://github.com/valerisn/Lattice/security/advisories/new), not public issues. Include the affected revision, reproduction steps, and impact. Do not send real credentials or private wiki content.

## Protections

- Parameterized SQL and server-side authorization
- Workspace roles, inherited page/collection restrictions, and group/member grants
- Scrypt with random 128-bit salts, N=32768, r=8, p=3; legacy development hashes upgrade on login
- Random 256-bit session tokens, hashed database storage, HttpOnly/SameSite cookies, and 14-day expiry
- Password changes and session issuance serialize on the account row; stale password checks cannot create surviving sessions or overwrite newer credentials
- Secure cookies when `APP_URL` uses HTTPS
- Exact Origin checks, bounded request bodies, and database-backed authentication/upload rate limits
- Workspace mutations recheck membership after body transfer and serialize authorization with permission changes; rejected uploads discard their stored bytes
- Setup token and serialized initialization
- File signatures, generated storage keys, and protected downloads
- Sanitized page content, frame denial, MIME sniffing protection, and baseline CSP

Scrypt parameters follow an [OWASP recommended configuration](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). CSP currently permits inline scripts for Next.js rendering; nonce-based enforcement is future work.

## Operational boundaries

Use HTTPS on public instances. Keep `APP_URL` accurate and setup credentials private. Update dependencies and back up the database and uploads. Restrict database/filesystem access to the operator.

The optional Linux daemon controls Docker with host-level authority. Configuration and state must belong to the service user, with private file/directory permissions; daemon rejects symlinks and unsafe parent directories. Backups contain secrets. Keep the deployment checkout writable only by trusted host administrators. Release updates trust the official HTTPS GitHub origin; independent release-signature verification is not implemented.

Attachments are not malware-scanned. Non-image documents download as attachments. SVG, HTML, executable, and archive uploads are unsupported. Treat downloaded documents as untrusted.

PGlite is development-only. Navigation/search currently load workspace data in memory. Use a reverse proxy with request limits and plan capacity for large or hostile deployments.

CI audits runtime dependencies. The current Next.js lint dependency chain has an upstream `braces` denial-of-service advisory affecting glob patterns, with no compatible patched release at initial implementation. It affects development/CI tooling, not the production request path. Track upstream updates before accepting untrusted build inputs.
