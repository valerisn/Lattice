"use client";
import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import {
  Details,
  DetailsContent,
  DetailsSummary,
} from "@tiptap/extension-details";
import { Markdown } from "@tiptap/markdown";
import { common, createLowlight } from "lowlight";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Plus,
} from "lucide-react";
import type { WikiPage } from "@/shared/types";
import { api } from "@/client/api";

const lowlight = createLowlight(common);
export function RichEditor({
  initialContent,
  onChange,
  pages,
  workspaceSlug,
  workspaceId,
}: {
  initialContent: string;
  onChange: (markdown: string) => void;
  pages: WikiPage[];
  workspaceSlug: string;
  workspaceId: string;
}) {
  const [slash, setSlash] = useState(false);
  const [members, setMembers] = useState<
    { id: string; name: string; username: string }[]
  >([]);
  useEffect(() => {
    let alive = true;
    api<{ id: string; name: string; username: string }[]>(
      `/api/w/${workspaceId}/members`,
    )
      .then((data) => {
        if (alive) setMembers(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [workspaceId]);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false, link: { openOnClick: false } }),
      TableKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ allowBase64: false }),
      Placeholder.configure({
        placeholder: "Write something worth keeping. Type / for blocks…",
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Details.extend({
        renderMarkdown(node, helpers) {
          return `<details>\n${helpers.renderChildren(node.content || [])}\n</details>`;
        },
      }),
      DetailsSummary.extend({
        renderMarkdown(node, helpers) {
          return `<summary>${helpers.renderChildren(node.content || [])}</summary>\n`;
        },
      }),
      DetailsContent.extend({
        renderMarkdown(node, helpers) {
          return `\n${helpers.renderChildren(node.content || [])}\n`;
        },
      }),
      Markdown.configure({ markedOptions: { gfm: true } }),
    ],
    content: initialContent,
    contentType: "markdown",
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
    editorProps: {
      attributes: {
        "aria-label": "Page content",
        role: "textbox",
        "aria-multiline": "true",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "/") setSlash(true);
        if (event.key === "Escape") setSlash(false);
        return false;
      },
    },
  });
  if (!editor) return <p className="muted">Opening editor…</p>;
  const commands = [
    ["Text", () => editor.chain().focus().setParagraph().run()],
    [
      "Heading 1",
      () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    ],
    [
      "Heading 2",
      () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    ],
    [
      "Heading 3",
      () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    ],
    ["Bullet list", () => editor.chain().focus().toggleBulletList().run()],
    ["Numbered list", () => editor.chain().focus().toggleOrderedList().run()],
    ["Task list", () => editor.chain().focus().toggleTaskList().run()],
    ["Quote", () => editor.chain().focus().toggleBlockquote().run()],
    ["Code block", () => editor.chain().focus().toggleCodeBlock().run()],
    [
      "Callout",
      () =>
        editor
          .chain()
          .focus()
          .insertContent("> **Note**\n> Something worth noticing.", {
            contentType: "markdown",
          })
          .run(),
    ],
    [
      "Table",
      () =>
        editor
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    ],
    [
      "Image",
      () => {
        const src = window.prompt("Image URL (https:// or an attachment URL)");
        if (src && /^(https:\/\/|\/api\/)/.test(src))
          editor.chain().focus().setImage({ src }).run();
      },
    ],
    ["Divider", () => editor.chain().focus().setHorizontalRule().run()],
    ["Expandable section", () => editor.chain().focus().setDetails().run()],
  ] as const;
  const apply = (fn: () => unknown) => {
    const { from } = editor.state.selection;
    if (editor.state.doc.textBetween(Math.max(0, from - 1), from) === "/")
      editor.commands.deleteRange({ from: from - 1, to: from });
    setSlash(false);
    fn();
  };
  return (
    <div className="rich-editor">
      <div className="editor-toolbar" aria-label="Text formatting">
        <button
          title="Bold (Ctrl+B)"
          aria-label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={16} />
        </button>
        <button
          aria-label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={16} />
        </button>
        <button
          aria-label="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline size={16} />
        </button>
        <button
          aria-label="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough size={16} />
        </button>
        <button
          aria-label="Inline code"
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code size={16} />
        </button>
        <button
          aria-label="Insert link"
          onClick={() => {
            const href = window.prompt(
              "Link URL",
              editor.getAttributes("link").href || "https://",
            );
            if (href === null) return;
            if (!href) editor.chain().focus().unsetLink().run();
            else if (/^(https?:\/\/|mailto:|\/)/.test(href))
              editor.chain().focus().setLink({ href }).run();
          }}
        >
          <LinkIcon size={16} />
        </button>
        <span className="toolbar-divider" />
        <button
          aria-label="Undo"
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={16} />
        </button>
        <button
          aria-label="Redo"
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={16} />
        </button>
        <button onClick={() => setSlash(!slash)}>
          <Plus size={16} />
          Block
        </button>
        <select
          aria-label="Insert page link"
          value=""
          onChange={(e) => {
            const page = pages.find((p) => p.id === e.target.value);
            if (page)
              editor
                .chain()
                .focus()
                .insertContent({
                  type: "text",
                  text: page.title,
                  marks: [
                    {
                      type: "link",
                      attrs: { href: `/w/${workspaceSlug}?page=${page.id}` },
                    },
                  ],
                })
                .run();
          }}
        >
          <option value="">Link a page…</option>
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Mention a teammate"
          value=""
          onChange={(e) => {
            const member = members.find((m) => m.id === e.target.value);
            if (member)
              editor
                .chain()
                .focus()
                .insertContent([
                  {
                    type: "text",
                    text: `@${member.username}`,
                    marks: [{ type: "bold" }],
                  },
                  { type: "text", text: " " },
                ])
                .run();
          }}
        >
          <option value="">Mention…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {editor.isActive("codeBlock") && (
          <select
            aria-label="Code language"
            defaultValue={editor.getAttributes("codeBlock").language || ""}
            onChange={(e) =>
              editor
                .chain()
                .focus()
                .updateAttributes("codeBlock", {
                  language: e.target.value || null,
                })
                .run()
            }
          >
            <option value="">Plain text</option>
            {[
              "typescript",
              "javascript",
              "json",
              "bash",
              "python",
              "css",
              "sql",
              "html",
            ].map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        )}
        {editor.isActive("table") && (
          <>
            <button onClick={() => editor.chain().focus().addRowAfter().run()}>
              + Row
            </button>
            <button
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              + Column
            </button>
            <button onClick={() => editor.chain().focus().deleteTable().run()}>
              Delete table
            </button>
          </>
        )}
      </div>
      {slash && (
        <div
          className="slash-menu"
          aria-label="Insert block"
          onKeyDown={(e) => {
            const buttons = Array.from(
              e.currentTarget.querySelectorAll("button"),
            );
            const index = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              buttons[
                (index + (e.key === "ArrowDown" ? 1 : buttons.length - 1)) %
                  buttons.length
              ]?.focus();
            }
            if (e.key === "Escape") setSlash(false);
          }}
        >
          {commands.map(([name, fn], i) => (
            <button autoFocus={i === 0} key={name} onClick={() => apply(fn)}>
              {name}
            </button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} className="prose editor-content" />
    </div>
  );
}
