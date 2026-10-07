import { describe, expect, it, vi } from "vitest";
import { fetchUpdate } from "../src/server/updates";

describe("release checks", () => {
  it.each([
    ["v0.2.0", "0.1.0", "available"],
    ["v0.10.0", "0.9.0", "available"],
    ["v1.0.0", "1.0.0-beta.2", "available"],
    ["v0.1.0", "0.1.0", "current"],
    ["v0.1.0", "0.2.0", "ahead"],
  ])("compares %s against %s", async (tag, installed, status) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ tag_name: tag, draft: false, prerelease: false }),
      );
    const result = await fetchUpdate(fetcher, installed);
    expect(result.status).toBe(status);
    expect(result.releaseUrl).toContain(
      "https://github.com/valerisn/Lattice/releases/tag/",
    );
    expect(fetcher.mock.calls[0][1]?.headers).not.toHaveProperty(
      "Authorization",
    );
  });
  it("distinguishes an unpublished release from network and malformed responses", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect((await fetchUpdate(fetcher)).status).toBe("unreleased");
    fetcher.mockResolvedValueOnce(new Response(null, { status: 403 }));
    expect((await fetchUpdate(fetcher)).status).toBe("unavailable");
    fetcher.mockRejectedValueOnce(new Error("timeout"));
    expect((await fetchUpdate(fetcher)).status).toBe("unavailable");
    fetcher.mockResolvedValueOnce(
      Response.json({ tag_name: "broken", draft: false, prerelease: false }),
    );
    expect((await fetchUpdate(fetcher)).status).toBe("unavailable");
  });
});
