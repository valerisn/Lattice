# Internal API

The browser API is experimental, not a stable public interface. Authenticate with the session cookie and include the exact `APP_URL` origin on mutations. Responses are JSON except attachment downloads. Errors return `{ "error": "Human-readable message" }`.

Common statuses: 400 invalid input, 401 signed out, 403 denied, 404 missing/inaccessible, 409 stale version/constraint conflict, 413 oversized body, 429 rate limited.

| Methods           | Route                                                    | Purpose                                     |
| ----------------- | -------------------------------------------------------- | ------------------------------------------- |
| POST              | `/api/auth/setup`, `/api/auth/login`, `/api/auth/logout` | Setup and sessions                          |
| GET/PATCH/POST    | `/api/account`                                           | Profile, password, and sessions             |
| GET/POST          | `/api/workspaces`                                        | List/create workspaces                      |
| GET/POST          | `/api/w/:workspaceId/pages`                              | List/create pages                           |
| GET/PATCH/DELETE  | `/api/w/:workspaceId/pages/:pageId`                      | Read/update/delete a leaf page              |
| POST              | `/api/w/:workspaceId/pages/:pageId/move`                 | Reorder/reparent                            |
| POST              | `/api/w/:workspaceId/pages/:pageId/favorite`             | Set favorite flag                           |
| GET               | `/api/w/:workspaceId/pages/:pageId/revisions`            | Latest 100 revisions                        |
| POST              | `/api/w/:workspaceId/pages/:pageId/restore`              | Restore a revision                          |
| GET               | `/api/w/:workspaceId/search?q=term`                      | Search accessible knowledge                 |
| POST/PATCH/DELETE | `/api/w/:workspaceId/collections[/:id]`                  | Manage collections                          |
| GET/PATCH         | `/api/w/:workspaceId/admin`                              | Admin overview/settings                     |
| GET/PATCH/DELETE  | `/api/w/:workspaceId/members[/:id]`                      | Members and roles                           |
| POST/DELETE       | `/api/w/:workspaceId/invites[/:id]`                      | Generate/revoke invite links                |
| POST              | `/api/invites/accept`                                    | Consume invitation                          |
| POST/PATCH/DELETE | `/api/w/:workspaceId/groups[/:id]`                       | Groups and assignments                      |
| POST/DELETE       | `/api/w/:workspaceId/permissions[/:id]`                  | Access grants                               |
| GET/POST          | `/api/w/:workspaceId/pages/:pageId/attachments`          | List/upload multipart `file`                |
| GET/DELETE        | `/api/attachments/:id`                                   | Protected download/delete                   |
| GET               | `/api/health`                                            | Database health without environment details |

Page create/update fields: `title`, `description`, `content`, `parent_id`, `collection_id`, `state`, `position`. Updates require the current `version` and accept a revision `summary`. `state` is `draft` or `published`. Move accepts `parent_id` and `before_id`, both nullable. Restore accepts `revisionId` and the current page `version`.

Grants require one of `page_id`/`collection_id`, one of `user_id`/`group_id`, and `capability` (`read` or `edit`). Set unused target fields to null. See [permission semantics](architecture.md).

API tokens, bulk endpoints, and long-term compatibility guarantees are planned.
