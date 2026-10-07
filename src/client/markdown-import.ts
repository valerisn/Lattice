export interface ImportedMarkdown {
  name: string;
  title: string;
  content: string;
}

export async function readMarkdownFile(
  file: Pick<File, "name" | "size" | "text">,
): Promise<ImportedMarkdown> {
  if (!/\.(md|markdown)$/i.test(file.name))
    throw new Error("Choose a .md or .markdown file.");
  if (file.size > 500000)
    throw new Error("Markdown imports must be 500 KB or smaller.");
  const content = (await file.text()).replace(/^\uFEFF/, "");
  if (
    content.length > 500000 ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(content)
  )
    throw new Error(
      "This file does not look like a readable Markdown document.",
    );
  const title =
    file.name
      .replace(/\.(md|markdown)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim()
      .slice(0, 200) || "Imported page";
  return { name: file.name, title, content };
}
