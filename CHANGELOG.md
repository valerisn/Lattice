# Changelog

Changes listed under **Unreleased** are available on the main branch. They are not a published stable release.

## Unreleased

### Writing and reading

- Focus mode expands the editor and hides page details while keeping autosave active.
- Ctrl/Cmd + S saves immediately without closing the editor.
- Code examples show language labels, copy controls, and clipboard failure feedback. Copying preserves indentation and line breaks.
- The reading outline follows the current section and keeps it visible in long outlines.
- Rich-editor checklists align correctly, including nested tasks and narrow layouts.
- The editor excludes the current page, descendants, and read-only pages from parent choices.
- Save feedback handles invalid titles, reverted changes, and changes made while a save is still running.
- Search clears stale results immediately and supports accessible keyboard selection with automatic scrolling.
- Attachment loading can be retried. Upload success no longer depends on a second request, and failed deletions leave the file available for retry.
- Open dialogs keep the background page still and restore scrolling when closed.

### Administration

- Generated invitation links have copy feedback and a manual-copy fallback. Revoking the displayed invitation clears its link.
- Account changes keep their confirmed success message if session loading fails. The session list shows loading and retry states, and disables signing out other sessions when none remain.
- System settings link to both Linux and Windows daemon setup, with backup inspection commands.
- Documentation review can show published pages not updated in at least 90 days, oldest first.
- Review lists expand in groups of eight pages.
- Audit history supports activity-type filters and literal searches across actor names and changed items, including older results.

### daemon

- `daemon backups` lists the newest 50 backup directories with complete, incomplete, or unreadable manifest states.
- `daemon verify-backup <name>` verifies the four backup files against a completed manifest without requiring Docker or stopping containers. JSON output is supported.
- Windows service lifecycle checks now report progress and use bounded diagnostic calls.

### Project documentation

- Refreshed the README with a branded banner, real sample-workspace screenshots, an appearance-aware preview, and clearer Linux/Windows daemon guidance.
- Expanded the writing and API guides for the new workflows.
