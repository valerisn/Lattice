import { expect, type Page } from "@playwright/test";

export async function checkSlashCommands(
  page: Page,
  base: string,
  headers: { origin: string },
  slug = "test-studio",
) {
  const response = await page.request.post(`${base}/pages`, {
    headers,
    data: { title: "Slash command fixture" },
  });
  expect(response.status()).toBe(201);
  const doc = await response.json();
  try {
    await page.goto(`/w/${slug}?page=${doc.id}`);
    await page.getByRole("button", { name: "Edit page", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Make it worth keeping" });
    const editor = dialog.getByRole("textbox", {
      name: "Page content",
      exact: true,
    });
    const menu = dialog.locator(".slash-menu");
    await editor.click();
    await editor.pressSequentially(
      "Visit https://example.test/docs and read /opt/lattice.",
    );
    await expect(menu).toHaveCount(0);
    await expect(editor).toContainText("https://example.test/docs");
    await editor.press("Enter");
    await editor.press("/");
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("button", { name: "Text", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(editor).toBeFocused();
    await editor.pressSequentially("opt/lattice");
    await expect(menu).toHaveCount(0);
    await expect(editor).toContainText("/opt/lattice");
    await editor.press("Enter");
    await dialog
      .getByRole("button", { name: "Inline code", exact: true })
      .click();
    await editor.pressSequentially("/usr/local");
    await expect(menu).toHaveCount(0);
    await expect(editor.locator("p > code")).toHaveText("/usr/local");
    await dialog
      .getByRole("button", { name: "Inline code", exact: true })
      .click();
    await editor.press("Enter");
    await dialog.getByRole("button", { name: "Block", exact: true }).click();
    await menu.getByRole("button", { name: "Code block", exact: true }).click();
    await editor.pressSequentially("/var/log/lattice");
    await expect(menu).toHaveCount(0);
    await expect(editor.locator("pre")).toHaveText("/var/log/lattice");
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const saved = await (
      await page.request.get(`${base}/pages/${doc.id}`)
    ).json();
    expect(saved.content).toContain("https://example.test/docs");
    expect(saved.content).toContain("`/usr/local`");
    expect(saved.content).toContain("/var/log/lattice");
  } finally {
    await page.request.delete(`${base}/pages/${doc.id}`, { headers });
    await page.goto(`/w/${slug}`);
  }
}
