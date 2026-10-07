import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  checkOrigin,
  digest,
} from "../src/server/security";
describe("security", () => {
  it("salts passwords and rejects invalid credentials", async () => {
    const hash = await hashPassword("a long memorable password");
    expect(hash).not.toBe(await hashPassword("a long memorable password"));
    expect(await verifyPassword("a long memorable password", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("wrong", "malformed")).toBe(false);
  });
  it("rejects cross-site and originless mutations", () => {
    expect(() =>
      checkOrigin(
        new Request("http://localhost:3000/api", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrow();
    expect(() =>
      checkOrigin(new Request("http://localhost:3000/api", { method: "POST" })),
    ).toThrow();
    expect(() =>
      checkOrigin(
        new Request("http://localhost:3000/api", {
          method: "POST",
          headers: { origin: "http://localhost:3000" },
        }),
      ),
    ).not.toThrow();
    expect(digest("session-token")).not.toContain("session-token");
  });
});
