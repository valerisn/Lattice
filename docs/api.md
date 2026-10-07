# Internal API

The browser API is experimental, not a stable public interface. Authenticate with the session cookie and include the exact `APP_URL` origin on mutations. Responses are JSON except attachment downloads. Errors return `{ "error": "Human-readable message" }`.

Common statuses: 400 invalid input, 401 signed out, 403 denied, 404 missing/inaccessible, 409 stale version/constraint conflict, 413 oversized body, 429 rate limited.

| Methods           | Route                                                    | Purpose                                      |
| ----------------- | -------------------------------------------------------- | -------------------------------------------- |
| POST              | `/api/auth/setup`, `/api/auth/login`, `/api/auth/logout` | Setup and sessions                           |
| GET/PATCH/POST    | `/api/account`                                           | Profile, password, and sessions              |
| GET/POST          | `/api/workspaces`                                        | List/create workspaces                       |
| GET/POST          | `/api/w/:workspaceId/pages`                              | List/create pages                            |
| GET/PATCH/DELETE  | `/api/w/:workspaceId/pages/:pageId`                      | Read/update/delete a leaf page               |
| POST              | `/api/w/:workspaceId/pages/:pageId/move`                 | Reorder/reparent                             |
| POST              | `/api/w/:workspaceId/pages/:pageId/favorite`             | Set favorite flag                            |
| GET               | `/api/w/:workspaceId/pages/:pageId/revisions`            | Latest 100 revisions                         |
| POST              | `/api/w/:workspaceId/pages/:pageId/restore`              | Restore a revision                           |
| GET               | `/api/w/:workspaceId/search?q=term`                      | Search accessible knowledge                  |
| POST/PATCH/DELETE | `/api/w/:workspaceId/collections[/:id]`                  | Manage collections                           |
| GET/PATCH         | `/api/w/:workspaceId/admin`                              | Admin overview/settings                      |
| POST              | `/api/w/:workspaceId/updates`                            | Admin-only stable release check              |
| PATCH             | `/api/w/:workspaceId/documentation`                      | Admin-only documentation preferences         |
| GET               | `/api/w/:workspaceId/audit[?before=:eventId]`            | Admin-only audit history, 50 events per page |
| GET/PATCH/DELETE  | `/api/w/:workspaceId/members[/:id]`                      | Members and roles                            |
| POST/DELETE       | `/api/w/:workspaceId/invites[/:id]`                      | Generate/revoke invite links                 |
| POST              | `/api/invites/accept`                                    | Consume invitation                           |
| POST/PATCH/DELETE | `/api/w/:workspaceId/groups[/:id]`                       | Groups and assignments                       |
| POST/DELETE       | `/api/w/:workspaceId/permissions[/:id]`                  | Access grants                                |
| GET/POST          | `/api/w/:workspaceId/pages/:pageId/attachments`          | List/upload multipart `file`                 |
| GET/DELETE        | `/api/attachments/:id`                                   | Protected download/delete                    |
| GET               | `/api/health`                                            | Database health without environment details  |

Page create/update fields: `title`, `description`, `content`, `parent_id`, `collection_id`, `state`, `position`. Updates require the current `version` and accept a revision `summary`. `state` is `draft` or `published`. Move accepts `parent_id` and `before_id`, both nullable. Restore accepts `revisionId` and the current page `version`.

Grants require one of `page_id`/`collection_id`, one of `user_id`/`group_id`, and `capability` (`read` or `edit`). Set unused target fields to null. See [permission semantics](architecture.md).

API tokens, bulk endpoints, and long-term compatibility guarantees are planned.

Creating an invitation accepts `email` and `role` (`admin`, `editor`, or `viewer`) and returns `{ id, url }` with status 201. Only workspace owners can invite administrators. Links expire after seven days and must be shared manually; Lattice does not send invitation email. The URL contains the invitation token and is returned only when created. Use the ID to revoke it with `DELETE /invites/:id`.

Page templates are available at `/api/w/:workspaceId/templates`: writers can `GET` summaries or `GET /:id` for Markdown content; administrators can `POST` a template, `PATCH /:id`, or `DELETE /:id`. Create accepts `name` (1–80 characters) and `content` (up to 500,000 characters). Updates also require `version` and reject stale edits with 409. Each workspace supports 100 templates. Template mutations appear in the audit log.

Page creation accepts an optional `template_id` from the same workspace. The template supplies the initial Markdown when `content` is omitted. Later template changes or deletion never modify existing pages.

Audit history accepts optional `action` and `q` query parameters alongside `before`. `action` is an exact key from the [audit action map](../src/shared/audit.ts), such as `groups.POST`. `q` is a case-insensitive literal substring of the actor name or target, limited to 200 characters after trimming. Filters apply before pagination. Keep the same filters when following `nextCursor`; omit `before` when changing them. Audit access remains limited to workspace administrators.

Workspace settings (`PATCH /admin`) accept partial updates to `name`, `description`, `logo`, `accent`, `homepage_id`, and `upload_limit`. Omitted fields remain unchanged. Send an empty logo string to restore the default, or a null homepage ID to choose the first available page.

Documentation preferences accept partial updates: `default_state` (`draft` or `published`), `reading_width` (`comfortable` or `wide`), `show_toc`, `show_author`, `show_updated`, `show_reading_time` (booleans), and `footer_text` (at most 200 characters). The configured publication default applies when a page creation request omits `state`; existing pages are unaffected.
