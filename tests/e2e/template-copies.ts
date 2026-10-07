import { expect, type Page } from "@playwright/test";

export async function checkTemplateCopies(
  page: Page,
  base: string,
  headers: { origin: string },
  slug = "test-studio",
) {
  const path = `${base}/templates`;
  const response = await page.request.post(path, {
    headers,
    data: {
      name: (
        `Runbook ${crypto.randomUUID().slice(0, 8)} ` +
        "incident response ".repeat(5)
      ).slice(0, 80),
      content: "## Respond\n\nKeep the original instructions.",
    },
  });
  expect(response.status()).toBe(201);
  const source = await response.json();
  const ids = [source.id];
  const before = (await (await page.request.get(path)).json()).length;
  let failRead = true;
  const pattern = `**${path}`;
  await page.route(pattern, async (route) => {
    if (route.request().method() === "GET" && failRead)
      await route.fulfill({
        status: 503,
        json: { error: "Templates temporarily unavailable." },
      });
    else await route.continue();
  });
  try {
    await page.goto(`/w/${slug}/settings?section=templates`);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Templates temporarily unavailable.",
    );
    await expect(
      page.getByRole("button", { name: "New template", exact: true }),
    ).toBeDisabled();
    failRead = false;
    await page.getByRole("button", { name: "Retry loading templates" }).click();
    const duplicate = page.getByRole("button", {
      name: `Duplicate ${source.name}`,
      exact: true,
    });
    await expect(duplicate).toBeEnabled();
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize(viewport);
    await duplicate.click();
    const dialog = page.getByRole("dialog", { name: "Create page template" });
    const name = dialog.getByLabel("Template name", { exact: true });
    expect((await name.inputValue()).length).toBeLessThanOrEqual(80);
    await expect(name).toHaveValue(/ \(copy\)$/);
    await expect(
      dialog.getByLabel("Template Markdown", { exact: true }),
    ).toHaveValue(source.content);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect((await (await page.request.get(path)).json()).length).toBe(before);
    await duplicate.click();
    await dialog
      .getByLabel("Template Markdown", { exact: true })
      .fill("## Respond\n\nUse these revised instructions.");
    const saved = page.waitForResponse(
      (r) => r.url().endsWith(path) && r.request().method() === "POST",
    );
    await dialog
      .getByRole("button", { name: "Save template", exact: true })
      .click();
    const savedResponse = await saved;
    expect(savedResponse.status()).toBe(201);
    const copied = await savedResponse.json();
    ids.push(copied.id);
    expect(copied.id).not.toBe(source.id);
    expect(copied.content).toContain("revised instructions");
    await expect(dialog).toHaveCount(0);
    const original = await (
      await page.request.get(`${path}/${source.id}`)
    ).json();
    expect(original.content).toBe(source.content);
    expect(original.version).toBe(source.version);
  } finally {
    await page.unroute(pattern);
    for (const id of ids)
      await page.request.delete(`${path}/${id}`, { headers });
    await page.goto(`/w/${slug}`);
  }
}
