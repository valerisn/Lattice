# Writing and organizing documentation

Choose **New page**, give it a title, and select a parent page or collection. The publication selector follows the workspace default. Published pages are available to members with access; drafts stay hidden from viewers. Drafts are still visible to editors and administrators with access.

## Start with existing content

In the new-page dialog, choose **Import Markdown** to read a `.md` or `.markdown` file up to 500 KB. Lattice suggests a title from the filename if the title is blank. Review the title, location, and publication state, then create the page. The original file stays on your computer, and the new page gets normal revision history.

Images and linked files are not imported automatically. Upload them through the page's attachment menu and update relative links. HTML inside Markdown goes through the same sanitizer as content written in Lattice.

Administrators can create reusable starting content in **Workspace settings → Templates**. Choose a **Starting template** when creating a page, or import a file. Imported content takes precedence. Editing or deleting a template never changes existing pages.

Use **Duplicate** beside a template to start a separate copy. Adjust its name and content, then save it. The original stays unchanged, and closing without saving creates nothing.

## Edit and review

Choose **Edit page** for the rich editor. Type `/` for blocks, or switch to Markdown for direct source editing. Changes save automatically; the save status tells you when they reach the server. If another session changes the page, the editor keeps your unsaved text and reports the conflict. Download it before reloading and merging.

The slash menu opens when you type `/` in an empty paragraph. Slashes within text, URLs, and code stay part of your content. Press **Escape** to dismiss the block menu and keep writing.

Press **Ctrl/Cmd + S** inside the editor to save immediately without closing it. **Done** saves pending changes before returning to the page.

Choose **Focus** for a larger writing surface in either rich text or Markdown. Description, location, and publication controls stay hidden while you write; **Exit focus** brings them back with your changes intact. Autosave and keyboard saving continue in focus mode.

Use **More page actions → Version history** to review previous versions. **Compare with current** highlights added and removed Markdown lines and shows title or description changes. You can switch to a side-by-side view. Large comparisons fall back to that view to keep the browser responsive. Restoring creates another revision and preserves the earlier history. The **Export Markdown** action downloads the current page source.

Focus **More page actions** and press **Arrow Up/Down** to open its choices. Use the arrow keys, **Home**, and **End** to move between them; **Escape** closes the menu. Closing a history or attachments dialog returns focus to the actions control.

The table of contents follows rendered level-two and level-three headings. Repeated headings receive unique links, formatted heading text stays readable, and code examples are excluded. Administrators can change reading width, metadata visibility, the footer, and the table of contents under **Workspace settings → Documentation**.

On larger screens, the table of contents highlights the section you are reading as you scroll. Long outlines scroll independently to keep the current section visible.

Section links open any expandable sections that contain their destination, including nested details. This works when opening a shared URL, following the table of contents, or navigating with the keyboard. Unrelated expandable sections stay closed.

Fenced code examples show their language and a **Copy** button. Copying preserves indentation and line breaks. If your browser blocks clipboard access, the example stays selectable and the button lets you retry. Keyboard readers can focus a code example to scroll long lines. Copy controls stay out of printed pages.

Choose **More → Print / Save as PDF**, or use your browser's print shortcut, for a paper-friendly layout. Navigation and editing controls are hidden, dark mode becomes white paper, and expandable sections open for printing. Choose your browser's PDF destination to save a copy.

## Call out useful details

Start a blockquote with `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, or `[!CAUTION]` on its own line. Lattice renders a labeled callout with an icon. Use the rich editor's **Callout** block to insert a note, or edit the marker in Markdown. Ordinary blockquotes keep their existing appearance.

```markdown
> [!TIP]
> Link to the decision behind a process, not just the steps.
>
> You can include **emphasis**, links, lists, and code examples.
```

## Share and organize

Page links can connect related knowledge. Sharing copies the page URL; recipients still need permission to read it. Favorites keep frequently used pages close, and **Ctrl/Cmd + K** searches accessible pages and collections.

The **Linked from** section lists accessible pages in the same workspace that link to the current page. It recognizes relative and same-origin full URLs, including Markdown reference links. Links inside code examples do not count. Restricted pages and drafts that you cannot read stay out of the list.

Move pages in the sidebar to change their order or parent. Moving under a restricted page can change who can read the page through inherited permissions. Administrators can inspect group and individual access grants in workspace settings.

The breadcrumb trail links to parent pages. Browser Back and Forward navigate between documents, and Recent pages, Favorites, and collection views have bookmarkable URLs. Browser tab titles include the current page and workspace.

Writers can use **Drafts** in the sidebar to find unfinished pages, ordered by most recently updated. Drafts stay hidden from viewers. Open a draft, choose **Edit page**, and change **Publication** to publish it. Published children of a draft remain hidden from viewers until their ancestors are published too.

Administrators can use **Workspace settings → Overview → Documentation review** to find drafts, empty pages, recent changes, or published pages not updated in at least 90 days. The 90-day list starts with the oldest pages and provides a starting point for review; age alone does not mean content is incorrect. **Show more pages** expands any review list in groups of eight.

Under **Workspace settings → Audit log**, filter by activity type or search a person's name or changed item. Filters search the full workspace audit history, and **Load older activity** keeps those filters as you move through earlier events.
