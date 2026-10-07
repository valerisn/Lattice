import { expect, type Page } from "@playwright/test";

export async function checkAttachmentFeedback(page: Page, base: string) {
  const pattern = `**${base}/pages/*/attachments`;
  let reads = 0;
  let failLoads = true;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let deletes = 0;
  const deletePattern = "**/api/attachments/feedback-fixture";
  await page.route(deletePattern, async (route) => {
    deletes++;
    await route.fulfill(
      deletes === 1
        ? { status: 503, json: { error: "Delete temporarily unavailable." } }
        : { json: { ok: true } },
    );
  });
  await page.route(pattern, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        json: {
          id: "feedback-fixture",
          name: "notes.md",
          mime: "text/plain",
          size: 5,
        },
      });
      return;
    }
    reads++;
    if (failLoads) {
      await held;
      await route.fulfill({
        status: 503,
        json: { error: "Attachments temporarily unavailable." },
      });
    } else await route.fulfill({ json: [] });
  });
  try {
    await page.getByLabel("More page actions", { exact: true }).click();
    await page
      .getByRole("button", { name: "Attachments", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Files that belong here" });
    await expect(dialog.getByRole("status")).toHaveText("Loading attachments…");
    const upload = dialog.getByRole("button", {
      name: "Upload attachment",
      exact: true,
    });
    await expect(upload).toBeDisabled();
    await expect(dialog.getByText("No attachments yet.")).toHaveCount(0);
    release();
    await expect(dialog.getByRole("alert")).toContainText(
      "Attachments temporarily unavailable.",
    );
    failLoads = false;
    await dialog
      .getByRole("button", { name: "Retry loading attachments" })
      .click();
    await expect(dialog.getByText("No attachments yet.")).toBeVisible();
    await expect(upload).toBeEnabled();
    const readsBeforeUpload = reads;
    await dialog.getByLabel("Upload a file").setInputFiles({
      name: "notes.md",
      mimeType: "text/plain",
      buffer: Buffer.from("Notes"),
    });
    await upload.click();
    await expect(
      dialog.getByRole("link", { name: "notes.md", exact: true }),
    ).toBeVisible();
    await expect(dialog.getByRole("status")).toContainText(
      "notes.md uploaded.",
    );
    await expect(dialog.getByLabel("Upload a file")).toHaveValue("");
    // Upload success doesn't depend on a second request which could fail.
    expect(reads).toBe(readsBeforeUpload);
    const remove = dialog.getByRole("button", {
      name: "Delete notes.md",
      exact: true,
    });
    page.once("dialog", (confirmation) => confirmation.accept());
    await remove.click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Delete temporarily unavailable.",
    );
    await expect(
      dialog.getByRole("link", { name: "notes.md", exact: true }),
    ).toBeVisible();
    await expect(upload).toBeEnabled();
    page.once("dialog", (confirmation) => confirmation.accept());
    await remove.click();
    await expect(dialog.getByRole("status")).toHaveText("notes.md deleted.");
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(dialog.getByText("No attachments yet.")).toBeVisible();
    await dialog.getByRole("button", { name: "Close dialog" }).click();
  } finally {
    release();
    await page.unroute(pattern);
    await page.unroute(deletePattern);
  }
}
