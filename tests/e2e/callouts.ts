import { expect, type Page } from "@playwright/test";

export async function checkCallouts(
  page: Page,
  base: string,
  headers: { origin: string },
  slug = "test-studio",
) {
  const kinds = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"];
  const response = await page.request.post(`${base}/pages`, {
    headers,
    data: {
      title: "Callout reading fixture",
      content:
        kinds
          .map(
            (kind) =>
              `> [!${kind}]\n> **Useful detail** with [a source](https://example.test).\n>\n> - Keep the context.`,
          )
          .join("\n\n") + "\n\n> An ordinary quote.\n\nA final paragraph.",
    },
  });
  expect(response.status()).toBe(201);
  const doc = await response.json();
  const viewport = page.viewportSize()!;
  try {
    await page.goto(`/w/${slug}?page=${doc.id}`);
    await expect(page.locator(".callout")).toHaveCount(5);
    for (const kind of kinds) {
      const callout = page.locator(`.callout-${kind.toLowerCase()}`);
      await expect(callout).toHaveAttribute(
        "aria-label",
        `${kind[0]}${kind.slice(1).toLowerCase()} callout`,
      );
      await expect(callout.locator("strong")).toHaveText("Useful detail");
      await expect(callout.locator("li")).toHaveText("Keep the context.");
    }
    await expect(page.locator(".prose blockquote")).toHaveText(
      "An ordinary quote.",
    );
    await page.getByRole("button", { name: "Edit page", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Make it worth keeping" });
    const editor = dialog.getByRole("textbox", {
      name: "Page content",
      exact: true,
    });
    await editor.locator(":scope > p").last().click();
    await editor.press("End");
    await editor.press("Enter");
    await editor.pressSequentially("Another detail from the rich editor.");
    await editor.press("Enter");
    await dialog.getByRole("button", { name: "Block", exact: true }).click();
    await dialog.getByRole("button", { name: "Callout", exact: true }).click();
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByText("Another detail from the rich editor.", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".callout")).toHaveCount(6);
    await expect(
      page.getByText("Something worth noticing.", { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    await expect(page.locator(".callout-warning .callout-title")).toHaveCSS(
      "color",
      "rgb(233, 177, 93)",
    );
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".callout-warning .callout-title")).toHaveCSS(
      "color",
      "rgb(34, 34, 34)",
    );
    await expect(page.locator(".callout-warning")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
  } finally {
    await page.emulateMedia({ media: "screen" });
    await page.setViewportSize(viewport);
    await page.request.delete(`${base}/pages/${doc.id}`, { headers });
    await page.goto(`/w/${slug}`);
  }
}
