import { expect, type Page } from "@playwright/test";

export async function checkCodeExamples(
  page: Page,
  base: string,
  headers: { origin: string },
  slug = "test-studio",
) {
  const code = 'const label = "<Lattice> & friends";\n  console.log(label);\n';
  const created = await page.request.post(`${base}/pages`, {
    headers,
    data: {
      title: "Code examples",
      content: `Inline \`value\` stays inline.\n\n\`\`\`javascript\n${code}\`\`\`\n\n\`\`\`\nplain text\n\`\`\``,
    },
  });
  expect(created.status()).toBe(201);
  const doc = await created.json();
  await page.goto(`/w/${slug}?page=${doc.id}`);
  const blocks = page.locator(".code-block");
  await expect(blocks).toHaveCount(2);
  await expect(blocks.first().locator(".code-block-language")).toHaveText(
    "javascript",
  );
  await expect(blocks.last().locator(".code-block-language")).toHaveText(
    "Plain text",
  );
  await expect(blocks.first().locator("pre")).toHaveText(code);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          document.documentElement.dataset.copiedCode = text;
        },
      },
    });
  });
  const copy = blocks
    .first()
    .getByRole("button", { name: "Copy code", exact: true });
  await copy.focus();
  await page.keyboard.press("Enter");
  await expect(copy).toHaveText("Copied");
  expect(
    await page.evaluate(() => document.documentElement.dataset.copiedCode),
  ).toBe(code);
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new Error("Clipboard denied");
    };
  });
  await copy.click();
  await expect(blocks.first().getByRole("status")).toContainText(
    "Couldn’t copy",
  );
  await expect(copy).toHaveText("Try again");
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {};
  });
  await copy.click();
  await expect(copy).toHaveText("Copied");
  await expect(blocks.first().getByRole("status")).toHaveText(
    "Code copied to clipboard.",
  );
  await page.emulateMedia({ media: "print" });
  await expect(copy).toBeHidden();
  await expect(blocks.first().locator("pre")).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(copy).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize(viewport);
  expect(
    (await page.request.delete(`${base}/pages/${doc.id}`, { headers })).ok(),
  ).toBe(true);
  await page.goto(`/w/${slug}`);
}
