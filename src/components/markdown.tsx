"use client";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";
import { common, createLowlight } from "lowlight";
import type { Element, RootContent } from "hast";
const lowlight = createLowlight(common);
function highlightNodes(nodes: RootContent[]): React.ReactNode {
  return nodes.map((node, index) => node.type === "text" ? node.value : node.type === "element" ? <span key={index} className={((node as Element).properties.className as string[] || []).join(" ")}>{highlightNodes(node.children)}</span> : null);
}
export function headingId(text: string) { return text.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "section"; }
export function Markdown({ content }: { content: string }) {
  const components = useMemo(() => ({
    h1: ({ children }: { children?: React.ReactNode }) => <h1 id={headingId(String(children))}>{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 id={headingId(String(children))}>{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 id={headingId(String(children))}>{children}</h3>,
    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
      const language = /language-(\w+)/.exec(className || "")?.[1];
      const code = String(children).replace(/\n$/, "");
      return <code className={className}>{language && lowlight.registered(language) ? highlightNodes(lowlight.highlight(language,code).children) : children}</code>;
    },
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => <a href={href} rel="noopener noreferrer">{children}</a>,
    img: ({ src, alt }: { src?: string | Blob; alt?: string }) => typeof src === "string" ? <img src={src} alt={alt || ""} loading="lazy" /> : null,
  }), []);
  return <div className="prose"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]} components={components}>{content}</ReactMarkdown></div>;
}
