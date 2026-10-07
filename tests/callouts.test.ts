import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "../src/components/markdown";

const render = (content: string) =>
  renderToStaticMarkup(createElement(Markdown, { content }));

describe("Markdown callouts", () => {
  it("renders each supported label and keeps formatted block content", () => {
    for (const kind of ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]) {
      const html = render(
        `> [!${kind}]\n> **Keep** [the source](https://example.test).\n>\n> - First step\n> - Second step`,
      );
      expect(html).toContain(`class="callout callout-${kind.toLowerCase()}"`);
      expect(html).toContain("<strong>Keep</strong>");
      expect(html).toContain("<li>First step</li>");
      expect(html).not.toContain(`[!${kind}]`);
      expect(html).not.toContain('role="alert"');
    }
  });
  it("handles marker-only paragraphs, hard breaks, and nested callouts", () => {
    const html = render(
      "> [!NOTE]  \n> First line.\n>\n> > [!TIP]\n> > Nested advice.\n\n> [!WARNING]\n>\n> Separate paragraph.",
    );
    expect(html.match(/class="callout callout-/g)).toHaveLength(3);
    expect(html).toContain("First line.");
    expect(html).toContain("Nested advice.");
    expect(html).toContain("Separate paragraph.");
    expect(html).not.toContain("<p></p>");
    expect(html).not.toContain("<p><br/>");
  });
  it("leaves normal quotes, inline markers, unknown kinds, and code untouched", () => {
    for (const content of [
      "> Ordinary quote.",
      "> [!CUSTOM]\n> A custom label.",
      "> [!NOTE] on the same line",
      "> ` [!NOTE]`\n> Code marker.",
      "```md\n> [!NOTE]\n```",
      "> Intro\n>\n> [!NOTE]\n> Later marker.",
    ]) {
      expect(render(content)).not.toContain('class="callout callout-');
    }
  });
  it("keeps sanitization in place for callout contents and forged attributes", () => {
    const html = render(
      '> [!CAUTION]\n> <img src="x" onerror="alert(1)">\n> <script>alert(1)</script>\n> [Bad](javascript:alert(1))\n\n<blockquote data-callout="warning"><p>Forged label</p></blockquote>',
    );
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
    expect(html.match(/class="callout callout-/g)).toHaveLength(1);
    expect(html).toContain("<blockquote><p>Forged label</p></blockquote>");
  });
});
