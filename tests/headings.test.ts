import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { pageHeadings } from "../src/shared/headings";
import { Markdown } from "../src/components/markdown";

describe("documentation heading navigation", () => {
  it("uses unique matching anchors for formatted and repeated headings", () => {
    const content =
      "# Intro\n\n## Intro\n\n## **Install** the `SDK`\n\n## Intro\n\n## Intro-1\n\n## 日本語の見出し\n\n[Jump](#install-the-sdk)";
    const headings = pageHeadings(content);
    expect(headings.map((heading) => heading.id)).toEqual([
      "lattice-heading-intro-1",
      "lattice-heading-install-the-sdk",
      "lattice-heading-intro-2",
      "lattice-heading-intro-1-1",
      "lattice-heading-日本語の見出し",
    ]);
    expect(headings[1].title).toBe("Install the SDK");
    const html = renderToStaticMarkup(createElement(Markdown, { content }));
    for (const heading of headings)
      expect(html).toContain(`id="${heading.id}"`);
    expect(html).toContain('href="#lattice-heading-install-the-sdk"');
  });
  it("ignores fenced code and includes setext and sanitized HTML headings", () => {
    const content =
      "```md\n## Not a heading\n```\n\nActual heading\n---\n\n<h3 id=custom>HTML <em>heading</em></h3>\n\n[HTML](#custom)\n\n<script>alert('bad')</script>";
    expect(pageHeadings(content).map((heading) => heading.title)).toEqual([
      "Actual heading",
      "HTML heading",
    ]);
    const html = renderToStaticMarkup(createElement(Markdown, { content }));
    expect(html).not.toContain("<script");
    expect(html).toContain('href="#lattice-heading-html-heading"');
  });
  it("keeps accessibility references connected when a heading gets an anchor", () => {
    expect(
      pageHeadings("A statement.[^note]\n\n[^note]: Supporting detail."),
    ).toEqual([]);
    const html = renderToStaticMarkup(
      createElement(Markdown, {
        content: "A statement.[^note]\n\n[^note]: Supporting detail.",
      }),
    );
    expect(html).toContain('id="lattice-heading-footnotes"');
    expect(html).toContain('aria-describedby="lattice-heading-footnotes"');
    expect(html).toContain('href="#user-content-user-content-fn-note"');
    expect(html).toContain('id="user-content-user-content-fn-note"');
  });
});
