import { expect, type Page } from "@playwright/test";

export async function checkCreationProgress(
  page: Page,
  base: string,
  headers: { origin: string },
  slug = "test-studio",
) {
  const pattern = `**${base}/pages`;
  let posts = 0;
  let createdId = "";
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(pattern, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    posts++;
    expect(route.request().postDataJSON().content).toBe(
      "## Replacement import",
    );
    if (posts === 1) {
      await held;
      await route.fulfill({
        status: 503,
        json: { error: "Creation temporarily unavailable." },
      });
    } else await route.continue();
  });
  try {
    await page.getByRole("button", { name: "New page", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Give your idea a home" });
    const file = dialog.getByLabel("Import Markdown", { exact: true });
    await file.setInputFiles({
      name: "original.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("Original import"),
    });
    await expect(dialog.getByText("Ready to import original.md")).toBeVisible();
    await page.evaluate(() => {
      File.prototype.text = () =>
        new Promise((resolve) =>
          document.addEventListener(
            "lattice-test-read",
            () => resolve("## Replacement import"),
            { once: true },
          ),
        );
    });
    await file.setInputFiles({
      name: "replacement.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("Replacement import"),
    });
    await expect(dialog.getByText("Reading Markdown…")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Clear import", exact: true }),
    ).toBeDisabled();
    const close = dialog.getByRole("button", {
      name: "Close dialog",
      exact: true,
    });
    await expect(close).toBeDisabled();
    await page.evaluate(() =>
      document.dispatchEvent(new Event("lattice-test-read")),
    );
    await expect(
      dialog.getByText("Ready to import replacement.md"),
    ).toBeVisible();
    const title = dialog.getByLabel("Page title", { exact: true });
    await title.fill("Creation progress fixture");
    const create = dialog.getByRole("button", {
      name: "Create page",
      exact: true,
    });
    await create.click();
    await expect(
      dialog.getByRole("button", { name: "Creating…" }),
    ).toBeDisabled();
    await expect(title).toBeDisabled();
    await expect(close).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.mouse.click(5, 5);
    await expect(dialog).toBeVisible();
    expect(posts).toBe(1);
    release();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Creation temporarily unavailable.",
    );
    await expect(title).toBeEnabled();
    await expect(title).toHaveValue("Creation progress fixture");
    await expect(close).toBeEnabled();
    const created = page.waitForResponse(
      (r) =>
        r.url().endsWith(`${base}/pages`) && r.request().method() === "POST",
    );
    await create.click();
    const result = await created;
    expect(result.status()).toBe(201);
    createdId = (await result.json()).id;
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Replacement import", exact: true }),
    ).toBeVisible();
    expect(posts).toBe(2);
  } finally {
    release();
    await page.unroute(pattern);
    if (createdId)
      await page.request.delete(`${base}/pages/${createdId}`, { headers });
    await page.goto(`/w/${slug}`);
  }
}
