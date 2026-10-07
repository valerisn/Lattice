"use client";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";
import { common, createLowlight } from "lowlight";
import type { Element, RootContent } from "hast";
import { rehypeHeadingIds } from "@/shared/headings";
const lowlight = createLowlight(common);
function highlightNodes(nodes: RootContent[]): React.ReactNode {
  return nodes.map((node, index) =>
    node.type === "text" ? (
      node.value
    ) : node.type === "element" ? (
      <span
        key={index}
        className={(
          ((node as Element).properties.className as string[]) || []
        ).join(" ")}
      >
        {highlightNodes(node.children)}
      </span>
    ) : null,
  );
}
export function Markdown({ content }: { content: string }) {
  const components = useMemo(
    () => ({
      code: ({
        className,
        children,
      }: {
        className?: string;
        children?: React.ReactNode;
      }) => {
        const language = /language-(\w+)/.exec(className || "")?.[1];
        const code = String(children).replace(/\n$/, "");
        return (
          <code className={className}>
            {language && lowlight.registered(language)
              ? highlightNodes(lowlight.highlight(language, code).children)
              : children}
          </code>
        );
      },
      a: ({
        href,
        children,
        id,
        "aria-describedby": describedBy,
        "aria-label": label,
      }: {
        href?: string;
        children?: React.ReactNode;
        id?: string;
        "aria-describedby"?: string;
        "aria-label"?: string;
      }) => (
        <a
          href={href}
          id={id}
          aria-describedby={describedBy}
          aria-label={label}
          rel="noopener noreferrer"
        >
          {children}
        </a>
      ),
      img: ({ src, alt }: { src?: string | Blob; alt?: string }) =>
        typeof src === "string" ? (
          <img src={src} alt={alt || ""} loading="lazy" />
        ) : null,
    }),
    [],
  );
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHeadingIds]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
