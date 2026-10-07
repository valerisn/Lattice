import { expect, it } from "vitest";
import { detectMime } from "../src/server/storage";
import { readBytes } from "../src/server/body";
it("validates file signatures rather than trusting a MIME header", () => {
  expect(
    detectMime(Buffer.from("<svg onload=alert(1)>"), "image.png"),
  ).toBeNull();
  expect(detectMime(Buffer.from("89504e470d0a1a0a", "hex"), "file")).toBe(
    "image/png",
  );
  expect(detectMime(Buffer.from("hello"), "notes.md")).toBe("text/plain");
});
it("rejects oversized streamed bodies without a content-length", async () => {
  await expect(
    readBytes(
      new Request("http://localhost", {
        method: "POST",
        body: "too much data",
      }),
      4,
    ),
  ).rejects.toThrow("too large");
});
