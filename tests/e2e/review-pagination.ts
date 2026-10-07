import { expect, type Page } from "@playwright/test";

export async function checkReviewPagination(
  page: Page,
  base: string,
  headers: { origin: string },
  slug = "test-studio",
) {
  const ids: string[] = [];
  for (let i = 0; i < 9; i++) {
    const response = await page.request.post(`${base}/pages`, {
      headers,
      data: {
        title: `Review pagination ${i + 1}`,
        content: "Documentation ready for review.",
      },
    });
    expect(response.status()).toBe(201);
    ids.push((await response.json()).id);
  }
  try {
    await page.goto(`/w/${slug}/settings`);
    const review = page.getByRole("region", { name: "Documentation review" });
    const select = review.getByLabel("Review list", { exact: true });
    await select.selectOption("recent");
    await expect(review.locator(".overview-pages > li")).toHaveCount(8);
    await expect(review.getByRole("status")).toContainText("Showing 8 of");
    await review.getByRole("button", { name: "Show more pages" }).click();
    expect(
      await review.locator(".overview-pages > li").count(),
    ).toBeGreaterThan(8);
    await expect(
      review.getByRole("link", { name: /Review pagination 1 / }),
    ).toBeVisible();
    await select.selectOption("older");
    await expect(
      review.getByText(
        "No published pages have reached the 90-day review window.",
      ),
    ).toBeVisible();
    await expect(
      review.getByRole("button", { name: "Show more pages" }),
    ).toHaveCount(0);
    await select.selectOption("recent");
    await expect(review.locator(".overview-pages > li")).toHaveCount(8);
  } finally {
    for (const id of ids)
      expect(
        (await page.request.delete(`${base}/pages/${id}`, { headers })).ok(),
      ).toBe(true);
  }
  await page.goto(`/w/${slug}`);
}
