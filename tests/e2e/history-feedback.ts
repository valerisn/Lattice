import { expect, type Page } from "@playwright/test";

export async function checkHistoryFeedback(
  page: Page,
  base: string,
  headers: { origin: string },
  slug = "test-studio",
) {
  const created = await page.request.post(`${base}/pages`, {
    headers,
    data: {
      title: "History feedback fixture",
      content: "Original content to restore.",
    },
  });
  expect(created.status()).toBe(201);
  const doc = await created.json();
  const path = `${base}/pages/${doc.id}`;
  expect(
    (
      await page.request.patch(path, {
        headers,
        data: { ...doc, content: "Updated content before restore." },
      })
    ).ok(),
  ).toBe(true);
  let mode: "failed" | "empty" | "real" = "failed";
  let restores = 0;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const revisions = `**${path}/revisions`;
  const restore = `**${path}/restore`;
  await page.route(revisions, async (route) => {
    if (mode === "failed")
      await route.fulfill({
        status: 503,
        json: { error: "History temporarily unavailable." },
      });
    else if (mode === "empty") await route.fulfill({ json: [] });
    else await route.continue();
  });
  await page.route(restore, async (route) => {
    restores++;
    if (restores === 1) {
      await held;
      await route.fulfill({
        status: 503,
        json: { error: "Restore temporarily unavailable." },
      });
    } else await route.continue();
  });
  const open = async () => {
    if (
      !(await page
        .getByRole("button", { name: "Version history", exact: true })
        .isVisible())
    )
      await page.getByLabel("More page actions", { exact: true }).click();
    await page
      .getByRole("button", { name: "Version history", exact: true })
      .click();
  };
  try {
    await page.goto(`/w/${slug}?page=${doc.id}`);
    await open();
    const dialog = page.getByRole("dialog", {
      name: "Every chapter, remembered",
    });
    await expect(dialog.getByRole("alert")).toHaveText(
      "History temporarily unavailable.",
    );
    await expect(dialog.getByText("Loading revisions…")).toHaveCount(0);
    mode = "empty";
    await dialog
      .getByRole("button", { name: "Retry loading revisions" })
      .click();
    await expect(dialog.getByRole("status")).toHaveText(
      "No revisions are available for this page.",
    );
    await dialog.getByRole("button", { name: "Close dialog" }).click();
    mode = "real";
    await open();
    const navigation = dialog.getByRole("navigation", {
      name: "Page revisions",
    });
    const original = navigation.getByRole("button", { name: /^Version 1 / });
    await original.click();
    await expect(original).toHaveAttribute("aria-current", "true");
    await dialog
      .getByRole("button", { name: "Restore version 1", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Restoring…" }),
    ).toBeDisabled();
    await expect(original).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "Close dialog" }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    release();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Restore temporarily unavailable.",
    );
    await expect(original).toBeEnabled();
    await dialog
      .getByRole("button", { name: "Restore version 1", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByText("Original content to restore.", { exact: true }),
    ).toBeVisible();
    const restored = await (await page.request.get(path)).json();
    expect(restored.version).toBe(doc.version + 2);
    expect(restored.content).toBe(doc.content);
    expect(restores).toBe(2);
  } finally {
    release();
    await page.unroute(revisions);
    await page.unroute(restore);
    await page.request.delete(path, { headers });
    await page.goto(`/w/${slug}`);
  }
}
