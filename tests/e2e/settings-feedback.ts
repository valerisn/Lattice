import { expect, type Page } from "@playwright/test";

export async function checkSettingsFeedback(
  page: Page,
  base: string,
  slug = "test-studio",
) {
  const pattern = `**${base}/admin`;
  let failReads = true;
  let failWrite = false;
  let writes = 0;
  await page.route(pattern, async (route) => {
    if (route.request().method() === "PATCH") {
      writes++;
      await route.fulfill(
        failWrite
          ? { status: 503, json: { error: "Settings could not be saved." } }
          : { json: { ok: true } },
      );
    } else if (failReads)
      await route.fulfill({
        status: 503,
        json: { error: "Settings service unavailable." },
      });
    else await route.continue();
  });
  try {
    await page.goto(`/w/${slug}/settings?section=general`);
    const main = page.getByRole("main");
    const retry = main.getByRole("button", {
      name: "Retry loading settings",
      exact: true,
    });
    const save = main.getByRole("button", {
      name: "Save general settings",
      exact: true,
    });
    await expect(main.getByRole("alert")).toContainText(
      "Could not load the latest settings",
    );
    failReads = false;
    await retry.click();
    await expect(save).toBeEnabled();
    await expect(main.getByRole("alert")).toHaveCount(0);
    failReads = true;
    await save.click();
    await expect(main.getByRole("status")).toHaveText("Changes saved.");
    await expect(main.getByRole("alert")).toContainText(
      "Could not load the latest settings",
    );
    await expect(save).toBeDisabled();
    await main.getByRole("button", { name: "Members", exact: true }).click();
    await expect(
      main.getByRole("button", { name: "Create invitation", exact: true }),
    ).toBeDisabled();
    await expect(retry).toBeEnabled();
    failReads = false;
    await retry.click();
    await expect(main.getByRole("alert")).toHaveCount(0);
    await main.getByRole("button", { name: "General", exact: true }).click();
    await expect(save).toBeEnabled();
    expect(writes).toBe(1);
    failWrite = true;
    await save.click();
    await expect(main.getByRole("alert")).toHaveText(
      "Settings could not be saved.",
    );
    await expect(main.getByRole("status")).toHaveCount(0);
    await expect(save).toBeEnabled();
    await expect(retry).toHaveCount(0);
  } finally {
    await page.unroute(pattern);
    await page.goto(`/w/${slug}`);
  }
}
