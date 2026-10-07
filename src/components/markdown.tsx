"use client";
import { useMemo, type ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";
import { common, createLowlight } from "lowlight";
import type { Element, RootContent } from "hast";
import { rehypeHeadingIds } from "@/shared/headings";
import { CodeBlock } from "./code-block";
import {
  Info,
  Lightbulb,
  BookmarkCheck,
  TriangleAlert,
  ShieldAlert,
} from "lucide-react";
import { calloutKind, calloutLabels, rehypeCallouts } from "@/shared/callouts";
const calloutIcons = {
  note: Info,
  tip: Lightbulb,
  important: BookmarkCheck,
  warning: TriangleAlert,
  caution: ShieldAlert,
};
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
      details: (props: ComponentProps<"details"> & { node?: Element }) => {
        const attributes = { ...props };
        delete attributes.node;
        // Browsers can open a fragment's ancestors before React hydrates them.
        return <details {...attributes} suppressHydrationWarning />;
      },
      blockquote: ({
        children,
        node,
      }: {
        children?: React.ReactNode;
        node?: Element;
      }) => {
        const kind = calloutKind(node);
        if (!kind) return <blockquote>{children}</blockquote>;
        const Icon = calloutIcons[kind];
        return (
          <aside
            className={`callout callout-${kind}`}
            aria-label={`${calloutLabels[kind]} callout`}
          >
            <div className="callout-title">
              <Icon size={18} aria-hidden="true" />
              {calloutLabels[kind]}
            </div>
            {children}
          </aside>
        );
      },
      pre: ({
        children,
        node,
      }: {
        children?: React.ReactNode;
        node?: Element;
      }) => {
        const code = node?.children.find(
          (child) => child.type === "element" && child.tagName === "code",
        );
        const classes =
          code?.type === "element" ? code.properties.className : [];
        const language = Array.isArray(classes)
          ? classes
              .find(
                (value) =>
                  typeof value === "string" && value.startsWith("language-"),
              )
              ?.toString()
              .slice(9, 49)
          : undefined;
        return <CodeBlock language={language}>{children}</CodeBlock>;
      },
      code: ({
        className,
        children,
      }: {
        className?: string;
        children?: React.ReactNode;
      }) => {
        const language = /language-(\w+)/.exec(className || "")?.[1];
        const code = String(children);
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
        rehypePlugins={[
          rehypeRaw,
          rehypeSanitize,
          rehypeCallouts,
          rehypeHeadingIds,
        ]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
