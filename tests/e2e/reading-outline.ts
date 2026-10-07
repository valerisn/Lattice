import { expect, type Page } from "@playwright/test";

export async function checkReadingOutline(
  page: Page,
  base: string,
  headers: { origin: string },
  slug = "test-studio",
) {
  const created = await page.request.post(`${base}/pages`, {
    headers,
    data: {
      title: "Long reading guide",
      content: Array.from(
        { length: 20 },
        (_, i) =>
          `## Section ${i + 1}\n\n${"A paragraph that gives this section some room to breathe. ".repeat(i === 19 ? 1 : 30)}`,
      ).join("\n\n"),
    },
  });
  expect(created.status()).toBe(201);
  const doc = await created.json();
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/w/${slug}?page=${doc.id}`);
  const nav = page.getByRole("navigation", {
    name: "On this page",
    exact: true,
  });
  const active = nav.locator('[aria-current="location"]');
  await expect(active).toHaveText("Section 1");
  await page
    .locator("#lattice-heading-section-10")
    .evaluate((element) =>
      window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 95),
    );
  await expect(active).toHaveText("Section 10");
  const scrollBeforeModal = await page.evaluate(() => scrollY);
  await page.getByLabel("More page actions", { exact: true }).click();
  await page.getByRole("button", { name: "Attachments", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Files that belong here" }),
  ).toBeVisible();
  await page.mouse.move(5, 5);
  await page.mouse.wheel(0, 600);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await page.evaluate(() => scrollY)).toBe(scrollBeforeModal);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.mouse.move(800, 500);
  await page.mouse.wheel(0, 200);
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(scrollBeforeModal);
  await nav.getByRole("link", { name: "Section 3", exact: true }).click();
  await expect(page).toHaveURL(/#lattice-heading-section-3$/);
  await expect(active).toHaveText("Section 3");
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect(active).toHaveText("Section 20");
  const bounds = await active.boundingBox();
  const outline = await nav.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(outline!.y - 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
    outline!.y + outline!.height + 1,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(active).toHaveText("Section 1");
  await page.setViewportSize(viewport);
  expect(
    (await page.request.delete(`${base}/pages/${doc.id}`, { headers })).ok(),
  ).toBe(true);
  await page.goto(`/w/${slug}`);
}
