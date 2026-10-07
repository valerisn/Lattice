import { describe, it, expect } from "vitest";
import { revisionDiff } from "../src/shared/revision-diff";

describe("revision comparison", () => {
  it("preserves both documents and counts additions and removals", () => {
    const before = "# Plan\n\nOld instructions.\nKeep this.\n";
    const after = "# Plan\n\nNew instructions.\nMore detail.\nKeep this.\n";
    const diff = revisionDiff(before, after)!;
    expect(diff.added).toBe(2);
    expect(diff.removed).toBe(1);
    expect(
      diff.parts
        .filter((part) => !part.added)
        .map((part) => part.value)
        .join(""),
    ).toBe(before);
    expect(
      diff.parts
        .filter((part) => !part.removed)
        .map((part) => part.value)
        .join(""),
    ).toBe(after);
  });
  it("handles empty documents, unchanged content, and final newline changes", () => {
    expect(revisionDiff("", "")).toMatchObject({ added: 0, removed: 0 });
    expect(revisionDiff("Hello", "Hello")).toMatchObject({
      added: 0,
      removed: 0,
    });
    expect(revisionDiff("", "Hello")).toMatchObject({ added: 1, removed: 0 });
    expect(revisionDiff("Hello\n", "Hello")).toMatchObject({
      added: 1,
      removed: 1,
    });
  });
  it("falls back before processing oversized documents or too many lines", () => {
    expect(revisionDiff("x".repeat(200001), "")).toBeNull();
    expect(revisionDiff("x\n".repeat(4000), "")).toBeNull();
    expect(revisionDiff("old\n".repeat(1001), "new\n".repeat(1001))).toBeNull();
  });
});
