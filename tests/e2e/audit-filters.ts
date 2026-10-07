import { expect, type Page } from "@playwright/test";

export async function checkAuditFilters(
  page: Page,
  base: string,
  headers: { origin: string },
  slug = "test-studio",
) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const name = `Audit filter ${suffix}`;
  const response = await page.request.post(`${base}/groups`, {
    headers,
    data: { name },
  });
  expect(response.ok()).toBe(true);
  const admin = await (await page.request.get(`${base}/admin`)).json();
  const group = admin.groups.find(
    (item: { name: string }) => item.name === name,
  );
  expect(group).toBeTruthy();
  try {
    await page.goto(`/w/${slug}/settings?section=audit-log`);
    await expect(
      page.getByRole("heading", { name: "Audit log", exact: true }),
    ).toBeVisible();
    const search = page.getByRole("searchbox", {
      name: "Search activity",
      exact: true,
    });
    const type = page.getByRole("combobox", {
      name: "Activity type",
      exact: true,
    });
    await search.fill(suffix.toUpperCase());
    await expect(page.locator(".audit-list > li")).toHaveCount(1);
    await expect(page.locator(".audit-list")).toContainText(name);
    await type.selectOption("templates.POST");
    await expect(
      page.getByText("No administrative changes match these filters."),
    ).toBeVisible();
    await type.selectOption("groups.POST");
    await expect(page.locator(".audit-list > li")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Refresh activity", exact: true })
      .click();
    await expect(page.locator(".audit-list > li")).toHaveCount(1);
    const pattern = `**${base}/audit?*`;
    let release!: () => void;
    let started!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    await page.route(pattern, async (route) => {
      if (
        new URL(route.request().url()).searchParams.get("q") !==
        `slow-${suffix}`
      ) {
        await route.continue();
        return;
      }
      started();
      await held;
      await route.fulfill({
        json: {
          events: [
            {
              id: "stale",
              actor_name: "Old result",
              action: "groups.POST",
              target: "Outdated response",
              created_at: new Date().toISOString(),
            },
          ],
          nextCursor: null,
        },
      });
    });
    try {
      const returned = page.waitForResponse(
        (result) =>
          new URL(result.url()).searchParams.get("q") === `slow-${suffix}`,
      );
      await search.fill(`slow-${suffix}`);
      await entered;
      await search.fill(suffix);
      await expect(page.locator(".audit-list")).toContainText(name);
      release();
      await (await returned).finished();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          ),
      );
      await expect(page.locator(".audit-list")).not.toContainText(
        "Outdated response",
      );
      await expect(page.locator(".audit-list")).toContainText(name);
    } finally {
      release();
      await page.unroute(pattern);
    }
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(search).toBeVisible();
    await page.setViewportSize(viewport);
  } finally {
    expect(
      (
        await page.request.delete(`${base}/groups/${group.id}`, { headers })
      ).ok(),
    ).toBe(true);
  }
  await page.goto(`/w/${slug}`);
}
