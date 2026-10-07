import { describe, expect, it } from "vitest";
import type { WikiPage } from "../src/shared/types";
import { olderPublishedPages } from "../src/shared/documentation-review";

const now = Date.parse("2026-10-07T12:00:00Z");
const day = 24 * 60 * 60 * 1000;
const page = (id: string, age: number, state = "published") =>
  ({
    id,
    state,
    updated_at: new Date(now - age * day).toISOString(),
  }) as WikiPage;

describe("documentation review", () => {
  it("includes published pages at the 90-day cutoff and orders oldest first", () => {
    const pages = [
      page("boundary", 90),
      page("recent", 89),
      page("oldest", 180),
      page("draft", 120, "draft"),
      page("future", -1),
    ];
    expect(olderPublishedPages(pages, now).map((item) => item.id)).toEqual([
      "oldest",
      "boundary",
    ]);
    expect(pages[0].id).toBe("boundary");
  });
  it("skips invalid timestamps and accepts an empty workspace", () => {
    expect(
      olderPublishedPages(
        [
          {
            id: "invalid",
            state: "published",
            updated_at: "invalid",
          } as WikiPage,
        ],
        now,
      ),
    ).toEqual([]);
    expect(olderPublishedPages([], now)).toEqual([]);
  });
});
