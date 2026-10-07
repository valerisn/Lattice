import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "../src/components/markdown";
import { readBytes } from "../src/server/body";

describe("untrusted document content", () => {
  it("removes executable HTML, handlers, dangerous links and DOM-clobbering names", () => {
    const html = renderToStaticMarkup(
      createElement(Markdown, {
        content: [
          "<script>window.compromised=true</script>",
          '<img src="x" onerror="window.compromised=true">',
          '<svg onload="window.compromised=true"><a href="javascript:alert(1)">bad</a></svg>',
          '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
          '<form action="https://evil.example"><input name="password"></form>',
          '<a href="javascript:alert(1)">javascript</a>',
          '<a href="jav&#x61;script:alert(1)">encoded</a>',
          "[data](data:text/html;base64,PHNjcmlwdD4=)",
          '<h2 id="location">Safe heading</h2>',
          '<div id="document" name="cookie">Safe text</div>',
        ].join("\n\n"),
      }),
    );
    expect(html).not.toMatch(
      /<(script|iframe|svg|form)\b|\son(error|load)=|href="(?:javascript|data):|\sid="(?:location|document)"|\sname="cookie"/i,
    );
    expect(html).toContain("Safe heading");
    expect(html).toContain("Safe text");
  });
  it("bounds streamed bodies even when Content-Length is absent or false", async () => {
    for (const length of [undefined, "1"]) {
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(9));
          controller.enqueue(new Uint8Array(9));
        },
        cancel() {
          cancelled = true;
        },
      });
      const request = new Request("http://localhost/api", {
        method: "POST",
        headers: length ? { "content-length": length } : {},
        body: stream,
        duplex: "half",
      } as RequestInit);
      await expect(readBytes(request, 16)).rejects.toMatchObject({
        status: 413,
      });
      expect(cancelled).toBe(true);
    }
  });
});
