import { expect, type Page } from "@playwright/test";

export async function checkSearchNavigation(page: Page, base: string) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pattern = `**${base}/search?*`;
  await page.route(pattern, async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query === "waiting") await held;
    if (query === "failure") {
      await route.fulfill({
        status: 503,
        json: { error: "Search temporarily unavailable." },
      });
      return;
    }
    await route.fulfill({
      json: Array.from({ length: 20 }, (_, i) => ({
        id: `search-${i}`,
        title: `${query} result ${i + 1}`,
        excerpt: "An example result for keyboard navigation.",
        kind: "page",
      })),
    });
  });
  try {
    await page.getByRole("button", { name: /Search anything/ }).click();
    const dialog = page.getByRole("dialog", { name: "Find your way" });
    const input = dialog.getByRole("combobox", {
      name: "Search pages and collections",
    });
    await input.press("ArrowDown");
    await expect(input).not.toHaveAttribute("aria-activedescendant");
    await input.fill("first");
    await expect(dialog.getByRole("option")).toHaveCount(20);
    await input.fill("waiting");
    await input.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("option")).toHaveCount(0);
    await expect(dialog.getByRole("status")).toHaveText("Searching…");
    release();
    await expect(dialog.getByRole("option")).toHaveCount(20);
    for (let i = 0; i < 19; i++) await input.press("ArrowDown");
    const last = dialog.getByRole("option").last();
    await expect(last).toHaveAttribute("aria-selected", "true");
    await expect(input).toHaveAttribute(
      "aria-activedescendant",
      (await last.getAttribute("id"))!,
    );
    const bounds = await last.boundingBox();
    const list = await dialog.locator(".search-results").boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(list!.y - 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
      list!.y + list!.height + 1,
    );
    await input.fill("failure");
    await expect(dialog.getByRole("alert")).toHaveText(
      "Search temporarily unavailable.",
    );
    await expect(dialog.getByRole("option")).toHaveCount(0);
    await input.fill(" ");
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(
      dialog.getByText("Search page titles, content, and collections."),
    ).toBeVisible();
    await input.fill("recovered");
    await expect(dialog.getByRole("option")).toHaveCount(20);
    await input.press("ArrowDown");
    await input.press("Enter");
    await expect(page).toHaveURL(/page=search-1$/);
    await expect(dialog).toHaveCount(0);
    await page.goBack();
  } finally {
    release();
    await page.unroute(pattern);
  }
}
