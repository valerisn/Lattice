import { expect, type Page } from "@playwright/test";

export async function checkInvitationLinks(
  page: Page,
  base: string,
  headers: { origin: string },
  slug = "test-studio",
) {
  const ids: string[] = [];
  const email = `invite-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const otherEmail = `other-${email}`;
  const create = async (address: string) => {
    await page.getByLabel("Email", { exact: true }).fill(address);
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith(`${base}/invites`) && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Create invitation", exact: true })
      .click();
    const result = await response;
    expect(result.status()).toBe(201);
    const invitation = await result.json();
    expect(invitation.id).toMatch(/^[0-9a-f-]{36}$/);
    ids.push(invitation.id);
    await expect(
      page.getByLabel("Invitation link", { exact: true }),
    ).toHaveValue(invitation.url);
    return invitation;
  };
  try {
    await page.goto(`/w/${slug}/settings?section=members`);
    await create(otherEmail);
    const invitation = await create(email);
    const generated = page.getByRole("region", {
      name: "Generated invitation",
    });
    const copy = generated.getByRole("button", {
      name: "Copy invitation link",
    });
    await expect(generated).toContainText(email);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("Clipboard denied");
          },
        },
      });
    });
    await copy.click();
    await expect(generated.getByRole("status")).toContainText(
      "copy it manually",
    );
    const input = generated.getByLabel("Invitation link", { exact: true });
    await input.focus();
    expect(
      await input.evaluate((el: HTMLInputElement) =>
        el.value.slice(el.selectionStart!, el.selectionEnd!),
      ),
    ).toBe(invitation.url);
    await page.evaluate(() => {
      navigator.clipboard.writeText = async (text) => {
        document.documentElement.dataset.invitationCopy = text;
      };
    });
    await copy.focus();
    await page.keyboard.press("Enter");
    await expect(generated.getByRole("status")).toHaveText(
      "Invitation link copied.",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.dataset.invitationCopy,
      ),
    ).toBe(invitation.url);
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(copy).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize(viewport);
    const row = (address: string) =>
      page
        .locator(".row.spread")
        .filter({
          hasText: new RegExp(
            `^${address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s`,
          ),
        });
    await row(otherEmail)
      .getByRole("button", { name: "Revoke", exact: true })
      .click();
    await expect(row(otherEmail)).toHaveCount(0);
    await expect(input).toHaveValue(invitation.url);
    await row(email)
      .getByRole("button", { name: "Revoke", exact: true })
      .click();
    await expect(generated).toHaveCount(0);
    await expect(row(email)).toHaveCount(0);
    const accepted = await page.request.post("/api/invites/accept", {
      headers,
      data: { token: invitation.url.split("/").pop() },
    });
    expect(accepted.status()).toBe(404);
  } finally {
    for (const id of ids)
      await page.request.delete(`${base}/invites/${id}`, { headers });
    await page.goto(`/w/${slug}`);
  }
}
