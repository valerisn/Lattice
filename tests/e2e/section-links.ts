import { expect, type Page } from "@playwright/test";

export async function checkSectionLinks(
  page: Page,
  base: string,
  headers: { origin: string },
  slug = "test-studio",
) {
  const response = await page.request.post(`${base}/pages`, {
    headers,
    data: {
      title: "Section link fixture",
      content: `## Introduction

${"A little context before the details. ".repeat(120)}

<details><summary>Advanced setup</summary>
<details><summary>Nested instructions</summary>
<h2>Deep section</h2>
<p>The linked instructions are visible.</p>
</details>
</details>

<details><summary>Unrelated details</summary><p>Keep this closed.</p></details>

## Next steps

${"More space below the destination. ".repeat(120)}`,
    },
  });
  expect(response.status()).toBe(201);
  const doc = await response.json();
  const viewport = page.viewportSize()!;
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/w/${slug}?page=${doc.id}#lattice-heading-deep-section`);
    const outer = page.locator(".page-article details").filter({
      has: page.locator(":scope > summary", { hasText: "Advanced setup" }),
    });
    const inner = outer.locator("details");
    const destination = page.getByRole("heading", {
      name: "Deep section",
      exact: true,
    });
    await expect(outer).toHaveAttribute("open", "");
    await expect(inner).toHaveAttribute("open", "");
    await expect(destination).toBeInViewport();
    await expect(page.getByText("Keep this closed.")).not.toBeVisible();

    await page.getByText("Advanced setup", { exact: true }).click();
    await expect(destination).not.toBeVisible();
    const link = page
      .getByRole("navigation", { name: "On this page", exact: true })
      .getByRole("link", { name: "Deep section", exact: true });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(destination).toBeInViewport();
    await expect(outer).toHaveAttribute("open", "");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(destination).toBeInViewport();
    await expect(page.getByText("Keep this closed.")).not.toBeVisible();
    await page.evaluate(() => {
      location.hash = "%E0%A4%A";
    });
    await expect(destination).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await page.setViewportSize(viewport);
    expect(
      (await page.request.delete(`${base}/pages/${doc.id}`, { headers })).ok(),
    ).toBe(true);
    await page.goto(`/w/${slug}`);
  }
}
