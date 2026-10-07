import { test, expect } from "@playwright/test";

test("workspace lifecycle, revisions, uploads, and authorization", async ({
  page,
  browser,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByLabel("Workspace name", { exact: true }).fill("Test Studio");
  await page.getByLabel("Your name", { exact: true }).fill("Test Owner");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("owner@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-owner-long-passphrase");
  await page
    .getByLabel("Installation setup token")
    .fill("automated-test-setup-token");
  await page
    .getByRole("button", { name: "Create your workspace", exact: true })
    .click();
  await page.waitForURL("**/w/test-studio");
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  const workspaces = await (await page.request.get("/api/workspaces")).json();
  const workspace = workspaces[0];
  const base = `/api/w/${workspace.id}`;
  const headers = { origin: baseURL! };
  const request = async (path: string, method: string, data?: unknown) =>
    page.request.fetch(`${base}${path}`, { method, headers, data });
  await page.getByRole("button", { name: "New page", exact: true }).click();
  await page.getByLabel("Page title", { exact: true }).fill("Project notes");
  await page.getByRole("button", { name: "Create page", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Project notes", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit page", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Page content", exact: true })
    .fill("First revision from the rich editor.");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByText("First revision from the rich editor.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit page", exact: true }).click();
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  await page
    .getByLabel("Markdown content", { exact: true })
    .fill("## Knowledge persists\n\nSecond revision from Markdown.");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Knowledge persists", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Knowledge persists", exact: true }),
  ).toBeVisible();
  const pages = await (await request("/pages", "GET")).json();
  const note = pages.find(
    (p: { title: string }) => p.title === "Project notes",
  );
  const revisions = await (
    await request(`/pages/${note.id}/revisions`, "GET")
  ).json();
  expect(revisions.length).toBeGreaterThanOrEqual(3);
  expect(
    (
      await request(`/pages/${note.id}`, "PATCH", {
        ...note,
        version: 1,
        content: "stale",
      })
    ).status(),
  ).toBe(409);
  const restored = await request(`/pages/${note.id}/restore`, "POST", {
    revisionId: revisions[1].id,
    version: note.version,
  });
  expect(restored.status()).toBe(200);
  expect((await restored.json()).content).toContain("First revision");
  const upload = await page.request.post(
    `${base}/pages/${note.id}/attachments`,
    {
      headers,
      multipart: {
        file: {
          name: "notes.md",
          mimeType: "text/markdown",
          buffer: Buffer.from("An attachment"),
        },
      },
    },
  );
  expect(upload.status()).toBe(201);
  const attachment = await upload.json();
  expect(await (await page.request.get(attachment.url)).text()).toBe(
    "An attachment",
  );
  const unsafe = await page.request.post(
    `${base}/pages/${note.id}/attachments`,
    {
      headers,
      multipart: {
        file: {
          name: "image.svg",
          mimeType: "image/png",
          buffer: Buffer.from("<svg onload=alert(1)>"),
        },
      },
    },
  );
  expect(unsafe.status()).toBe(400);
  const anonymous = await browser.newContext({ baseURL });
  expect((await anonymous.request.get(attachment.url)).status()).toBe(401);
  const invite = await (
    await request("/invites", "POST", {
      email: "viewer@example.test",
      role: "viewer",
    })
  ).json();
  const token = invite.url.split("/").pop();
  const accepted = await anonymous.request.post("/api/invites/accept", {
    headers,
    data: {
      token,
      email: "viewer@example.test",
      name: "Test Viewer",
      password: "test-viewer-long-passphrase",
    },
  });
  expect(accepted.status()).toBe(200);
  expect(
    (
      await anonymous.request.post("/api/invites/accept", {
        headers,
        data: { token },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await anonymous.request.post(`${base}/pages`, {
        headers,
        data: { title: "Forbidden" },
      })
    ).status(),
  ).toBe(403);
  expect((await anonymous.request.get(`${base}/admin`)).status()).toBe(403);
  expect((await anonymous.request.get(`${base}/audit`)).status()).toBe(403);
  expect(
    (
      await anonymous.request.post(`${base}/updates`, { headers, data: {} })
    ).status(),
  ).toBe(403);
  expect(
    (
      await anonymous.request.patch(`${base}/documentation`, {
        headers,
        data: { show_author: false },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(`${base}/pages`, {
        headers: { origin: "https://evil.example" },
        data: { title: "Forbidden" },
      })
    ).status(),
  ).toBe(403);
  const members = await (await request("/members", "GET")).json();
  const owner = members.find((m: { role: string }) => m.role === "owner");
  expect((await request(`/members/${owner.id}`, "DELETE")).status()).toBe(409);
  expect(
    (
      await request("/permissions", "POST", {
        page_id: note.id,
        collection_id: null,
        user_id: owner.id,
        group_id: null,
        capability: "read",
      })
    ).status(),
  ).toBe(201);
  expect(
    (await anonymous.request.get(`${base}/pages/${note.id}`)).status(),
  ).toBe(404);
  expect((await anonymous.request.get(attachment.url)).status()).toBe(404);
  const results = await (
    await anonymous.request.get(`${base}/search?q=revision`)
  ).json();
  expect(results.some((p: { id: string }) => p.id === note.id)).toBe(false);
  await anonymous.close();
  await page.goto("/w/test-studio/settings");
  await page
    .getByRole("button", { name: "Groups & access", exact: true })
    .click();
  await page.getByLabel("New group", { exact: true }).fill("Writers");
  await page.getByRole("button", { name: "Create group", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Writers", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "System", exact: true }).click();
  await expect(page).toHaveURL(/section=system/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "System", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Software updates" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Check for updates", exact: true })
    .click();
  await expect(page.getByText(/Last checked/)).toBeVisible({ timeout: 15000 });
  await page
    .getByRole("button", { name: "Documentation", exact: true })
    .click();
  await page.goBack();
  await expect(page.getByText(/Last checked/)).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Documentation", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Default publication state").selectOption("draft");
  await page.getByLabel("Reading width").selectOption("wide");
  await page.getByLabel("Show table of contents").uncheck();
  await page.getByLabel("Show author", { exact: true }).uncheck();
  await page.getByLabel("Show last updated date").uncheck();
  await page.getByLabel("Show reading time").uncheck();
  await page.getByLabel("Footer text").fill("Test Studio knowledge base");
  await page
    .getByRole("button", { name: "Save documentation settings" })
    .click();
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Audit log", exact: true }).click();
  await expect(
    page.getByText("Updated documentation settings", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Created an invitation", { exact: true }),
  ).toBeVisible();
  await page.goto("/w/test-studio");
  await expect(
    page.getByText("Test Studio knowledge base", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".page-meta")).toHaveCount(0);
  await expect(page.locator(".table-of-contents")).toHaveCount(0);
  await expect(page.locator(".reader-layout")).toHaveClass(/reader-wide/);
  await page.getByRole("button", { name: "New page", exact: true }).click();
  await expect(page.getByLabel("Publication", { exact: true })).toHaveValue(
    "draft",
  );
  await page.keyboard.press("Escape");
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (await page.request.post("/api/auth/logout", { headers })).status(),
  ).toBe(200);
  expect((await page.request.get("/api/workspaces")).status()).toBe(401);
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Email or password is incorrect" }),
  ).toBeVisible();
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-owner-long-passphrase");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/w/test-studio");
  expect(errors).toEqual([]);
});
