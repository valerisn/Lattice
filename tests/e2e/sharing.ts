import { expect, type Page } from "@playwright/test";

export async function checkSharing(
  page: Page,
  base: string,
  headers: { origin: string },
  slug = "test-studio",
) {
  const response = await page.request.post(`${base}/pages`, {
    headers,
    data: {
      title: "Sharing fixture",
      content:
        "## First section\n\nSome context.\n\n## First section\n\nAnother section.\n\n### Café notes\n\nA Unicode heading.",
    },
  });
  expect(response.status()).toBe(201);
  const doc = await response.json();
  const viewport = page.viewportSize()!;
  try {
    await page.goto(`/w/${slug}?page=${doc.id}`);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("Clipboard blocked");
          },
        },
      });
    });
    const share = page.getByRole("button", { name: "Share", exact: true });
    await share.click();
    const dialog = page.getByRole("dialog", { name: "Share this page" });
    const field = dialog.getByLabel("Page link", { exact: true });
    const canonical = `${headers.origin}/w/${slug}?page=${doc.id}`;
    await expect(field).toHaveValue(canonical);
    await expect(
      dialog.getByText(/Sharing a link does not change its permissions/),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Copy link", exact: true })
      .click();
    await expect(dialog.getByRole("status")).toContainText("Could not copy.");
    await field.focus();
    expect(
      await field.evaluate(
        (element: HTMLInputElement) =>
          element.selectionEnd! - element.selectionStart!,
      ),
    ).toBe(canonical.length);
    await dialog
      .getByRole("combobox", { name: "Link destination", exact: true })
      .selectOption("lattice-heading-first-section-1");
    await expect(field).toHaveValue(
      `${canonical}#lattice-heading-first-section-1`,
    );
    await expect(dialog.getByRole("status")).not.toContainText(
      "Could not copy.",
    );
    await dialog
      .getByRole("combobox", { name: "Link destination", exact: true })
      .selectOption("lattice-heading-café-notes");
    const sectionUrl = `${canonical}#lattice-heading-caf%C3%A9-notes`;
    await expect(field).toHaveValue(sectionUrl);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            document.documentElement.dataset.copiedLink = value;
          },
        },
      });
    });
    await dialog
      .getByRole("button", { name: "Copy link", exact: true })
      .click();
    await expect(dialog.getByRole("status")).toHaveText("Link copied.");
    expect(
      await page.evaluate(() => document.documentElement.dataset.copiedLink),
    ).toBe(sectionUrl);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(share).toBeFocused();
    await share.click();
    await expect(field).toHaveValue(canonical);
    await page.keyboard.press("Escape");
    await page.goto(sectionUrl);
    await expect(
      page.getByRole("heading", { name: "Café notes", exact: true }),
    ).toBeInViewport();
  } finally {
    await page.setViewportSize(viewport);
    expect(
      (await page.request.delete(`${base}/pages/${doc.id}`, { headers })).ok(),
    ).toBe(true);
    await page.goto(`/w/${slug}`);
  }
}
