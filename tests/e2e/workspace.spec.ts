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
  await page.goto("/w/test-studio");
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
  expect(errors).toEqual([]);
});
