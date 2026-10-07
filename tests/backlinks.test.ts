import { describe, expect, it } from "vitest";
import { findBacklinks } from "../src/shared/backlinks";
import type { WikiPage } from "../src/shared/types";

const target = "a0c96a4e-26fb-4b80-a72a-1c6acdb09641";
const fixture = (title: string, content: string, id = crypto.randomUUID()) =>
  ({ id, title, content }) as WikiPage;
describe("page backlinks", () => {
  it("finds relative, absolute, and reference-style local links once per source", () => {
    const pages = [
      fixture(
        "Relative",
        `[one](/w/docs?page=${target}) [two](?page=${target})`,
      ),
      fixture(
        "Absolute",
        `[link](https://wiki.example/w/docs?page=${target}#section)`,
      ),
      fixture("Reference", `[read][guide]\n\n[guide]: /w/docs?page=${target}`),
    ];
    expect(
      findBacklinks(pages, target, "docs", "https://wiki.example").map(
        (page) => page.title,
      ),
    ).toEqual(["Absolute", "Reference", "Relative"]);
  });
  it("ignores code, unrelated workspaces, external hosts, and self links", () => {
    const pages = [
      fixture("Code", `\`[link](/w/docs?page=${target})\``),
      fixture(
        "External",
        `[link](https://other.example/w/docs?page=${target})`,
      ),
      fixture("Other workspace", `[link](/w/other?page=${target})`),
      fixture("Self", `[link](/w/docs?page=${target})`, target),
    ];
    expect(
      findBacklinks(pages, target, "docs", "https://wiki.example"),
    ).toEqual([]);
  });
});
