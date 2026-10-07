import { describe, expect, it } from "vitest";
import { readMarkdownFile } from "../src/client/markdown-import";

describe("Markdown file import", () => {
  it("suggests a title and preserves Markdown", async () => {
    const imported = await readMarkdownFile(
      new File(
        ["\uFEFF## Existing guide\n\n日本語 **content**"],
        "team-handbook.MD",
      ),
    );
    expect(imported.title).toBe("team handbook");
    expect(imported.content).toBe("## Existing guide\n\n日本語 **content**");
  });
  it("rejects unsupported extensions, oversized files, and binary content", async () => {
    await expect(
      readMarkdownFile(new File(["text"], "file.html")),
    ).rejects.toThrow(".md");
    await expect(
      readMarkdownFile(new File(["x".repeat(500001)], "big.md")),
    ).rejects.toThrow("500 KB");
    await expect(
      readMarkdownFile(new File(["binary\u0000text"], "binary.md")),
    ).rejects.toThrow("readable");
  });
});
