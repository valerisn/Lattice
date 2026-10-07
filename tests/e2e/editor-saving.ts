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
  const childResponse = await page.request.post(`${base}/pages`, {
    headers,
    data: { title: "Child of saving feedback", parent_id: doc.id },
  });
  expect(childResponse.status()).toBe(201);
  const child = await childResponse.json();
  const grandchildResponse = await page.request.post(`${base}/pages`, {
    headers,
    data: { title: "Grandchild of saving feedback", parent_id: child.id },
  });
  expect(grandchildResponse.status()).toBe(201);
  const grandchild = await grandchildResponse.json();
  await page.goto(`/w/${slug}?page=${doc.id}`);
  await page.getByRole("button", { name: "Edit page", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Make it worth keeping" });
  const status = dialog.getByRole("status");
  const title = dialog.getByLabel("Title", { exact: true });
  const parents = dialog.getByRole("combobox", {
    name: "Parent page",
    exact: true,
  });
  await expect(parents).toBeVisible();
  for (const id of [doc.id, child.id, grandchild.id])
    await expect(parents.locator(`option[value="${id}"]`)).toHaveCount(0);
  await expect(parents.locator('option[value=""]')).toHaveText("Top level");
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
  for (const id of [grandchild.id, child.id])
    expect(
      (await page.request.delete(`${base}/pages/${id}`, { headers })).ok(),
    ).toBe(true);
  expect(
    (await page.request.delete(`${base}/pages/${doc.id}`, { headers })).ok(),
  ).toBe(true);
  await page.goto(`/w/${slug}`);
}
