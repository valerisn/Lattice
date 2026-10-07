# Changelog

Changes listed under **Unreleased** are available on the main branch. They are not a published stable release.

## Unreleased

### Writing and reading

- The sharing dialog offers whole-page and section links, copy feedback, and a selectable URL when clipboard access fails.
- Section links reveal their destination inside collapsed or nested details, including shared URLs and keyboard navigation.
- Page actions support arrow-key navigation and dismiss on Escape or an outside click. Choosing an action closes the menu and provides a focus target when its dialog closes.
- Slash commands open only in empty paragraphs, preserving URLs, paths, and code. Escape closes the block picker without closing the editor.
- Markdown callouts render notes, tips, important information, warnings, and cautions with labels and icons. The rich editor's Callout block inserts a note.
- Creation dialogs keep submitted fields stable and stay open until the request finishes. Markdown import cannot be cleared while a file is still being read.
- Version history distinguishes loading, empty, and failed responses, supports retry, and keeps the selected version fixed while a restore runs.
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

- Templates can be duplicated into a separate editable draft. Failed template-list loads can be retried before creating a template.
- Generated invitation links have copy feedback and a manual-copy fallback. Revoking the displayed invitation clears its link.
- Account changes keep their confirmed success message if session loading fails. The session list shows loading and retry states, and disables signing out other sessions when none remain.
- Saved admin changes remain confirmed when the settings refresh fails. A retry reloads the latest data before editing resumes.
- System settings link to both Linux and Windows daemon setup, with backup inspection commands.
- Documentation review can show published pages not updated in at least 90 days, oldest first.
- Review lists expand in groups of eight pages.
- Audit history supports activity-type filters and literal searches across actor names and changed items, including older results.

### daemon

- `daemon pause` suspends automatic recovery and updates for maintenance while leaving containers and health checks running.
- Status explains automatic recovery eligibility, failed-check thresholds, cooldown, and the hourly restart limit, with structured JSON output.
- `daemon backups` lists the newest 50 backup directories with complete, incomplete, or unreadable manifest states.
- `daemon verify-backup <name>` verifies the four backup files against a completed manifest without requiring Docker or stopping containers. JSON output is supported.
- Windows service lifecycle checks now report progress and use bounded diagnostic calls.

### Project documentation

- Refreshed the README with a branded banner, real sample-workspace screenshots, an appearance-aware preview, and clearer Linux/Windows daemon guidance.
- Expanded the writing and API guides for the new workflows.
