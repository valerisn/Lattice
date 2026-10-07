import { expect, type Page } from "@playwright/test";

export async function checkAccountFeedback(page: Page, slug = "test-studio") {
  const pattern = "**/api/account";
  let failReads = true;
  let failRevoke = true;
  let reads = 0;
  let otherSession = true;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(pattern, async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      reads++;
      // Strict Mode can start more than one initial read in development.
      await held;
      await route.fulfill(
        failReads
          ? {
              status: 503,
              json: { error: "Session service unavailable." },
            }
          : {
              json: {
                sessions: [true, ...(otherSession ? [false] : [])].map(
                  (current) => ({
                    current,
                    created_at: "2026-01-01T12:00:00Z",
                    expires_at: "2027-01-01T12:00:00Z",
                  }),
                ),
              },
            },
      );
    } else if (
      request.method() === "POST" &&
      request.postDataJSON().action === "revoke"
    ) {
      if (failRevoke)
        await route.fulfill({
          status: 503,
          json: { error: "Sign-out temporarily unavailable." },
        });
      else {
        otherSession = false;
        await route.fulfill({ json: { ok: true } });
      }
    } else await route.fulfill({ json: { ok: true } });
  });
  try {
    await page.goto("/account");
    const revoke = page.getByRole("button", {
      name: "Sign out other sessions",
      exact: true,
    });
    await expect(page.getByRole("status")).toHaveText("Loading sessions…");
    await expect(revoke).toBeDisabled();
    release();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Could not load active sessions",
    );
    const beforeProfile = reads;
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(page.locator(".success[role=status]")).toHaveText(
      "Profile saved.",
    );
    expect(reads).toBe(beforeProfile);

    await page
      .getByLabel("Current password", { exact: true })
      .fill("fixture-current-passphrase");
    await page
      .getByLabel("New password", { exact: true })
      .fill("fixture-updated-passphrase");
    await page
      .getByRole("button", { name: "Update password", exact: true })
      .click();
    await expect(page.locator(".success[role=status]")).toHaveText(
      "Password updated. Other sessions have been signed out.",
    );
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Could not load active sessions",
    );
    await expect(
      page.getByLabel("Current password", { exact: true }),
    ).toHaveValue("");
    await expect(page.getByLabel("New password", { exact: true })).toHaveValue(
      "",
    );
    failReads = false;
    await page.getByRole("button", { name: "Retry loading sessions" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await expect(revoke).toBeEnabled();
    await revoke.click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Sign-out temporarily unavailable.",
    );
    await expect(page.getByText(/Another session · Created/)).toBeVisible();
    failRevoke = false;
    await revoke.click();
    await expect(page.locator(".success[role=status]")).toHaveText(
      "Other sessions have been signed out.",
    );
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await expect(
      page.getByText("You have no other active sessions."),
    ).toBeVisible();
    await expect(revoke).toBeDisabled();
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize(viewport);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await page.goto(`/w/${slug}`);
  }
}
