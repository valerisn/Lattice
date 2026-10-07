import { expect, type Page } from "@playwright/test";

export async function checkEditorSaving(
  page: Page,
  base: string,
  headers: { origin: string },
  slug = "test-studio",
) {
  const created = await page.request.post(`${base}/pages`, {
    headers,
    data: { title: "Saving feedback", content: "Original content" },
  });
  expect(created.status()).toBe(201);
  const doc = await created.json();
  await page.goto(`/w/${slug}?page=${doc.id}`);
  await page.getByRole("button", { name: "Edit page", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Make it worth keeping" });
  const status = dialog.getByRole("status");
  const title = dialog.getByLabel("Title", { exact: true });
  await title.fill("");
  await title.press("Control+s");
  await expect(status).toHaveText("Not saved");
  await expect(dialog.getByRole("alert")).toContainText(
    "Give this page a title",
  );
  await title.fill("Saving feedback");
  await expect(status).toHaveText("Saved");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Markdown", exact: true }).click();
  const content = dialog.getByLabel("Markdown content");
  await content.fill("Saved with the keyboard.");
  await content.press("Meta+s");
  await expect(status).toHaveText("Saved");
  expect(
    (await (await page.request.get(`${base}/pages/${doc.id}`)).json()).content,
  ).toBe("Saved with the keyboard.");

  let release!: () => void;
  let started!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  let hold = true;
  const pattern = `**${base}/pages/${doc.id}`;
  await page.route(pattern, async (route) => {
    if (route.request().method() === "PATCH" && hold) {
      hold = false;
      started();
      await held;
    }
    await route.continue();
  });
  try {
    await content.fill("A save still on its way.");
    await content.press("Control+s");
    await entered;
    await content.fill("Saved with the keyboard.");
    await expect(status).toHaveText("Unsaved changes");
    release();
    await expect(status).toHaveText("Saved");
    expect(
      (await (await page.request.get(`${base}/pages/${doc.id}`)).json())
        .content,
    ).toBe("Saved with the keyboard.");
  } finally {
    release();
    await page.unroute(pattern);
  }
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(
    (await page.request.delete(`${base}/pages/${doc.id}`, { headers })).ok(),
  ).toBe(true);
  await page.goto(`/w/${slug}`);
}
