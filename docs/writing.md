# Writing and organizing documentation

Choose **New page**, give it a title, and select a parent page or collection. The publication selector follows the workspace default. Published pages are available to members with access; drafts stay hidden from viewers. Drafts are still visible to editors and administrators with access.

## Start with existing content

In the new-page dialog, choose **Import Markdown** to read a `.md` or `.markdown` file up to 500 KB. Lattice suggests a title from the filename if the title is blank. Review the title, location, and publication state, then create the page. The original file stays on your computer, and the new page gets normal revision history.

Images and linked files are not imported automatically. Upload them through the page's attachment menu and update relative links. HTML inside Markdown goes through the same sanitizer as content written in Lattice.

Administrators can create reusable starting content in **Workspace settings → Templates**. Choose a **Starting template** when creating a page, or import a file. Imported content takes precedence. Editing or deleting a template never changes existing pages.

## Edit and review

Choose **Edit page** for the rich editor. Type `/` for blocks, or switch to Markdown for direct source editing. Changes save automatically; the save status tells you when they reach the server. If another session changes the page, the editor keeps your unsaved text and reports the conflict. Download it before reloading and merging.

Use **More → History** to compare revisions or restore an earlier one. Restoring creates another revision. The **Markdown export** action downloads the current page source.

The table of contents follows rendered level-two and level-three headings. Repeated headings receive unique links, formatted heading text stays readable, and code examples are excluded. Administrators can change reading width, metadata visibility, the footer, and the table of contents under **Workspace settings → Documentation**.

Choose **More → Print / Save as PDF**, or use your browser's print shortcut, for a paper-friendly layout. Navigation and editing controls are hidden, dark mode becomes white paper, and expandable sections open for printing. Choose your browser's PDF destination to save a copy.

## Share and organize

Page links can connect related knowledge. Sharing copies the page URL; recipients still need permission to read it. Favorites keep frequently used pages close, and **Ctrl/Cmd + K** searches accessible pages and collections.

The **Linked from** section lists accessible pages in the same workspace that link to the current page. It recognizes relative and same-origin full URLs, including Markdown reference links. Links inside code examples do not count. Restricted pages and drafts that you cannot read stay out of the list.

Move pages in the sidebar to change their order or parent. Moving under a restricted page can change who can read the page through inherited permissions. Administrators can inspect group and individual access grants in workspace settings.
