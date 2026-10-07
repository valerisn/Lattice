import { describe, expect, it } from "vitest";
import { pageAncestors } from "../src/shared/page-tree";
import type { WikiPage } from "../src/shared/types";

const fixture = (id: string, parent_id: string | null = null) =>
  ({ id, parent_id, title: id }) as WikiPage;
describe("page breadcrumbs", () => {
  it("orders visible ancestors from the root to the parent", () => {
    const root = fixture("root");
    const parent = fixture("parent", "root");
    const child = fixture("child", "parent");
    expect(
      pageAncestors(child, [child, parent, root]).map((page) => page.id),
    ).toEqual(["root", "parent"]);
    expect(pageAncestors(child, [child])).toEqual([]);
  });
  it("stops on invalid cycles without including the current page", () => {
    const a = fixture("a", "b");
    const b = fixture("b", "a");
    expect(pageAncestors(a, [a, b]).map((page) => page.id)).toEqual(["b"]);
    expect(pageAncestors(undefined, [])).toEqual([]);
  });
});
