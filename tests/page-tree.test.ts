import { describe, expect, it } from "vitest";
import { pageAncestors, pageSubtreeIds } from "../src/shared/page-tree";
import type { WikiPage, Workspace } from "../src/shared/types";
import { homepageId, pageViewTitle } from "../src/shared/navigation";

const fixture = (id: string, parent_id: string | null = null) =>
  ({ id, parent_id, title: id }) as WikiPage;
describe("page breadcrumbs", () => {
  it("excludes the whole subtree from potential parents, including deep descendants", () => {
    const pages = [
      fixture("root"),
      fixture("child", "root"),
      fixture("grandchild", "child"),
      fixture("other"),
    ];
    expect([...pageSubtreeIds("root", pages)]).toEqual([
      "root",
      "child",
      "grandchild",
    ]);
    expect([...pageSubtreeIds("other", pages)]).toEqual(["other"]);
  });
  it("walks deep or damaged trees without recursion or looping", () => {
    const pages = Array.from({ length: 10000 }, (_, index) =>
      fixture(String(index), index ? String(index - 1) : null),
    );
    expect(pageSubtreeIds("0", pages).size).toBe(10000);
    expect([
      ...pageSubtreeIds("a", [fixture("a", "b"), fixture("b", "a")]),
    ]).toEqual(["a", "b"]);
  });
  it("chooses an accessible homepage and does not invent titles for hidden pages", () => {
    const workspace = { homepage_id: "hidden" } as Workspace;
    expect(homepageId(workspace, [fixture("visible")])).toBe("visible");
    expect(homepageId(workspace, [])).toBeNull();
    expect(pageViewTitle("page", undefined, [])).toBe("Page");
    expect(pageViewTitle("recent", undefined, [])).toBe("Recently updated");
  });
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
