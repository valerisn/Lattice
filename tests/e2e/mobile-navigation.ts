import { expect, type Page } from "@playwright/test";

export async function checkMobileNavigation(page: Page, slug = "test-studio") {
  const viewport = page.viewportSize()!;
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/w/${slug}`);
    const open = page.getByRole("button", {
      name: "Open navigation",
      exact: true,
    });
    const sidebar = page.getByRole("complementary", {
      name: "Workspace navigation",
      exact: true,
    });
    await expect(open).toBeVisible();
    await expect(sidebar).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Share", exact: true }),
    ).toBeVisible();
    await open.click();
    const close = sidebar.getByRole("button", {
      name: "Collapse sidebar",
      exact: true,
    });
    await expect(close).toBeFocused();
    await expect(page.locator(".workspace-main")).toHaveAttribute("inert", "");
    expect(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).overflow,
      ),
    ).toBe("hidden");
    await page.keyboard.press("Shift+Tab");
    await expect(
      sidebar.getByRole("link", { name: "Grown with Lattice" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sidebar).toHaveCount(0);
    await expect(open).toBeFocused();
    await expect(page.locator(".workspace-main")).not.toHaveAttribute("inert");

    await open.click();
    const appearance = sidebar.getByRole("button", { name: /^Appearance:/ });
    await appearance.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(sidebar).toBeVisible();
    await expect(appearance).toBeFocused();
    await sidebar
      .getByRole("navigation", { name: "Workspace", exact: true })
      .getByRole("button", { name: "Home", exact: true })
      .click();
    await expect(sidebar).toHaveCount(0);
    await expect(open).toBeFocused();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(sidebar).toBeVisible();
    await sidebar
      .getByRole("button", { name: "Collapse sidebar", exact: true })
      .click();
    await expect(sidebar).toHaveCount(0);
    await page.setViewportSize({ width: 850, height: 900 });
    await open.click();
    await sidebar
      .getByRole("navigation", { name: "Workspace", exact: true })
      .getByRole("button", { name: "Home", exact: true })
      .click();
    await expect(sidebar).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(sidebar).toHaveCount(0);
    await open.click();
    await expect(sidebar).toBeVisible();
    await expect(page.locator(".workspace-main")).not.toHaveAttribute("inert");
  } finally {
    await page.setViewportSize(viewport);
    await page.goto(`/w/${slug}`);
  }
}
