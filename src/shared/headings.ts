import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import type { Root, RootContent, Element } from "hast";

export interface PageHeading {
  id: string;
  title: string;
  depth: number;
}

function visit(node: Root | RootContent, fn: (element: Element) => void) {
  if (node.type === "element") fn(node);
  if ("children" in node) for (const child of node.children) visit(child, fn);
}

function textContent(node: RootContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element" && node.tagName === "img")
    return String(node.properties.alt || "");
  return "children" in node ? node.children.map(textContent).join("") : "";
}

export function rehypeHeadingIds() {
  return (tree: Root) => {
    const used = new Set<string>();
    const aliases = new Map<string, string>();
    visit(tree, (element) => {
      const id = element.properties.id;
      if (typeof id === "string" && id.startsWith("user-content-"))
        aliases.set(id.slice("user-content-".length), id);
    });
    visit(tree, (element) => {
      if (!/^h[1-6]$/.test(element.tagName)) return;
      const title = textContent(element).trim();
      const slug =
        title
          .normalize("NFKC")
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .replace(/^-|-$/g, "") || "section";
      const base = `lattice-heading-${slug}`;
      let id = base;
      let suffix = 1;
      while (used.has(id)) id = `${base}-${suffix++}`;
      used.add(id);
      if (!aliases.has(slug)) aliases.set(slug, id);
      if (typeof element.properties.id === "string") {
        aliases.set(element.properties.id, id);
        aliases.set(element.properties.id.replace(/^user-content-/, ""), id);
      }
      element.properties.id = id;
    });
    visit(tree, (element) => {
      for (const property of ["ariaDescribedBy", "ariaLabelledBy"]) {
        const value = element.properties[property];
        if (Array.isArray(value))
          element.properties[property] = value.map(
            (id) => aliases.get(String(id)) || id,
          );
        else if (typeof value === "string")
          element.properties[property] = value
            .split(/\s+/)
            .map((id) => aliases.get(id) || id)
            .join(" ");
      }
      const href = element.properties.href;
      if (
        element.tagName !== "a" ||
        typeof href !== "string" ||
        !href.startsWith("#")
      )
        return;
      let fragment: string;
      try {
        fragment = decodeURIComponent(href.slice(1));
      } catch {
        return;
      }
      if (aliases.has(fragment))
        element.properties.href = `#${aliases.get(fragment)}`;
    });
  };
}

const outlineProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize)
  .use(rehypeHeadingIds);

export function pageHeadings(content: string): PageHeading[] {
  const tree = outlineProcessor.runSync(outlineProcessor.parse(content));
  const headings: PageHeading[] = [];
  visit(tree, (element) => {
    if (
      Array.isArray(element.properties.className) &&
      element.properties.className.includes("sr-only")
    )
      return;
    if (element.tagName === "h2" || element.tagName === "h3")
      headings.push({
        id: String(element.properties.id),
        title: textContent(element).trim(),
        depth: Number(element.tagName[1]),
      });
  });
  return headings;
}

export function markdownLinks(content: string): string[] {
  const tree = outlineProcessor.runSync(outlineProcessor.parse(content));
  const links: string[] = [];
  visit(tree, (element) => {
    if (element.tagName === "a" && typeof element.properties.href === "string")
      links.push(element.properties.href);
  });
  return links;
}
