import { expect, type Page } from "@playwright/test";

export async function checkEditorChecklists(
  page: Page,
  base: string,
  headers: { origin: string },
) {
  const created = await page.request.post(`${base}/pages`, {
    headers,
    data: {
      title: "Release checklist",
      content:
        "- [ ] Review the release notes and check that migration instructions are easy to find before upgrading an installation.\n  - [x] Confirm the backup\n- [x] Test sign-in",
    },
  });
  expect(created.status()).toBe(201);
  const task = await created.json();
  await page.goto(`/w/test-studio?page=${task.id}`);
  await page.getByRole("button", { name: "Edit page", exact: true }).click();
  const items = page.locator(".editor-content li[data-checked]");
  await expect(items).toHaveCount(3);
  const aligned = async () => {
    const label = await items.first().locator(":scope > label").boundingBox();
    const text = await items
      .first()
      .locator(":scope > div > p")
      .first()
      .boundingBox();
    expect(label).not.toBeNull();
    expect(text).not.toBeNull();
    expect(label!.width).toBeLessThan(32);
    expect(text!.x).toBeGreaterThan(label!.x + label!.width);
    expect(Math.abs(label!.y - text!.y)).toBeLessThan(12);
  };
  await aligned();
  const first = items.first().locator(':scope > label input[type="checkbox"]');
  await first.check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Edit page", exact: true }).click();
  await expect(first).toBeChecked();
  await expect(items.nth(1).locator(":scope > label input")).toBeChecked();
  const original = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  await aligned();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize(original);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    (await page.request.delete(`${base}/pages/${task.id}`, { headers })).ok(),
  ).toBe(true);
  await page.goto("/w/test-studio");
}
