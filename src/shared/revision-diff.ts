import { diffLines } from "diff";

export function revisionDiff(before: string, after: string) {
  // Comparing huge rewrites should not freeze the editor's browser tab.
  if (
    before.length + after.length > 200000 ||
    before.split("\n").length + after.split("\n").length > 4000
  )
    return null;
  const parts = diffLines(before, after, { timeout: 40, maxEditLength: 1000 });
  if (!parts) return null;
  return {
    parts,
    added: parts.reduce(
      (count, part) => count + (part.added ? part.count : 0),
      0,
    ),
    removed: parts.reduce(
      (count, part) => count + (part.removed ? part.count : 0),
      0,
    ),
  };
}
