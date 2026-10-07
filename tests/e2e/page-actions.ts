import { expect, type Page } from "@playwright/test";

export async function checkPageActions(page: Page) {
  const toggle = page.getByLabel("More page actions", { exact: true });
  const menu = page.locator(".more-menu");
  const history = menu.getByRole("button", {
    name: "Version history",
    exact: true,
  });
  const remove = menu.getByRole("button", { name: "Delete page", exact: true });
  // A streamed response can attach the menu before the loading screen clears.
  await expect(toggle).toBeVisible();
  await toggle.focus();
  await expect(toggle).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(history).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(remove).toBeFocused();
  await page.keyboard.press("Home");
  await expect(history).toBeFocused();
  await page.keyboard.press("End");
  await expect(remove).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open");
  await expect(toggle).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(remove).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Edit page", exact: true }),
  ).toBeFocused();
  await expect(menu).not.toHaveAttribute("open");
  await toggle.click();
  await expect(history).toBeVisible();
  await page.locator(".page-article h1").first().click();
  await expect(menu).not.toHaveAttribute("open");
  await toggle.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  const historyDialog = page.getByRole("dialog", {
    name: "Every chapter, remembered",
  });
  await expect(historyDialog).toBeVisible();
  await expect(menu).not.toHaveAttribute("open");
  await historyDialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(toggle).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(
    menu.getByRole("button", { name: "Attachments", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  const files = page.getByRole("dialog", { name: "Files that belong here" });
  await expect(files).toBeVisible();
  await expect(menu).not.toHaveAttribute("open");
  await files.getByRole("button", { name: "Close dialog" }).click();
  await expect(toggle).toBeFocused();
}
