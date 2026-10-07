import { test, expect } from "@playwright/test";
import { checkEditorChecklists } from "./editor-checklists";
import { checkCodeExamples } from "./code-examples";
import { checkSearchNavigation } from "./search-navigation";
import { checkReadingOutline } from "./reading-outline";
import { checkAttachmentFeedback } from "./attachment-feedback";
import { checkEditorSaving } from "./editor-saving";
import { checkReviewPagination } from "./review-pagination";
import { checkAuditFilters } from "./audit-filters";
import { checkAccountFeedback } from "./account-feedback";
import { checkInvitationLinks } from "./invitation-links";
import { checkSettingsFeedback } from "./settings-feedback";
import { checkTemplateCopies } from "./template-copies";
import { checkCreationProgress } from "./creation-progress";
import { checkHistoryFeedback } from "./history-feedback";

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
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "Recent pages", exact: true })
    .click();
  await expect(page).toHaveURL(/view=recent$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Recently updated", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "Home", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  const workspaces = await (await page.request.get("/api/workspaces")).json();
  const workspace = workspaces[0];
  const base = `/api/w/${workspace.id}`;
  const headers = { origin: baseURL! };
  const request = async (path: string, method: string, data?: unknown) =>
    page.request.fetch(`${base}${path}`, { method, headers, data });
  await checkEditorChecklists(page, base, headers);
  await checkCodeExamples(page, base, headers);
  await checkSearchNavigation(page, base);
  await checkReadingOutline(page, base, headers);
  await checkAttachmentFeedback(page, base);
  await checkEditorSaving(page, base, headers);
  await checkReviewPagination(page, base, headers);
  await checkAuditFilters(page, base, headers);
  await checkAccountFeedback(page);
  await checkInvitationLinks(page, base, headers);
  await checkSettingsFeedback(page, base);
  await checkTemplateCopies(page, base, headers);
  await checkCreationProgress(page, base, headers);
  await checkHistoryFeedback(page, base, headers);
  await page.getByRole("button", { name: "New page", exact: true }).click();
  await page.getByLabel("Page title", { exact: true }).fill("Project notes");
  await page.getByLabel("Parent page").selectOption({ label: "Home" });
  await page.getByRole("button", { name: "Create page", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Project notes", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Project notes · Test Studio · Lattice");
  await page
    .getByRole("navigation", { name: "Breadcrumb", exact: true })
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await expect(page).toHaveTitle("Home · Test Studio · Lattice");
  await page.goBack();
  await expect(page).toHaveTitle("Project notes · Test Studio · Lattice");
  await page.goForward();
  await expect(page).toHaveTitle("Home · Test Studio · Lattice");
  await page
    .getByRole("navigation", { name: "Page tree", exact: true })
    .getByRole("button", { name: "Project notes", exact: true })
    .click();
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
  await page.getByLabel("More page actions", { exact: true }).click();
  await page
    .getByRole("button", { name: "Version history", exact: true })
    .click();
  await page.getByLabel("Compare with current", { exact: true }).check();
  await expect(
    page.getByText("No content changes.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Page revisions", exact: true })
    .getByRole("button", { name: /^Version 2 / })
    .click();
  await expect(page.locator(".diff-removed")).toContainText("First revision");
  await expect(page.locator(".diff-added")).toContainText("Second revision");
  await page
    .getByLabel("Comparison format", { exact: true })
    .selectOption("side-by-side");
  await expect(page.locator(".revision-comparison pre")).toHaveCount(2);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
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
  expect((await anonymous.request.get(`${base}/templates`)).status()).toBe(403);
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
  await request("/pages", "POST", {
    title: "Public index",
    content: `[Workspace home](${baseURL}/w/test-studio?page=${workspace.homepage_id})`,
  });
  const privateIndex = await (
    await request("/pages", "POST", {
      title: "Private planning",
      content: `[Workspace home](/w/test-studio?page=${workspace.homepage_id})`,
    })
  ).json();
  await request("/permissions", "POST", {
    page_id: privateIndex.id,
    collection_id: null,
    user_id: owner.id,
    group_id: null,
    capability: "read",
  });
  await page.goto("/w/test-studio");
  const ownerLinks = page.getByRole("region", {
    name: "Linked from",
    exact: true,
  });
  await expect(
    ownerLinks.getByRole("link", { name: "Private planning", exact: true }),
  ).toBeVisible();
  await ownerLinks
    .getByRole("link", { name: "Public index", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Public index", exact: true }),
  ).toBeVisible();
  const viewerPage = await anonymous.newPage();
  const unpublished = await (
    await request("/pages", "POST", {
      title: "Unpublished checklist",
      state: "draft",
    })
  ).json();
  await viewerPage.goto("/w/test-studio?view=drafts");
  await expect(
    viewerPage.getByText(unpublished.title, { exact: true }),
  ).toHaveCount(0);
  await expect(
    viewerPage
      .getByRole("navigation", { name: "Workspace", exact: true })
      .getByRole("button", { name: /^Drafts/ }),
  ).toHaveCount(0);
  await viewerPage.goto("/w/test-studio");
  const viewerLinks = viewerPage.getByRole("region", {
    name: "Linked from",
    exact: true,
  });
  await expect(
    viewerLinks.getByRole("link", { name: "Public index", exact: true }),
  ).toBeVisible();
  await expect(
    viewerLinks.getByRole("link", { name: "Private planning", exact: true }),
  ).toHaveCount(0);
  await viewerPage.goto(`/w/test-studio?page=${privateIndex.id}`);
  await expect(
    viewerPage.getByRole("heading", {
      name: "This page is not available.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(viewerPage).toHaveTitle("Page · Test Studio · Lattice");
  await anonymous.close();
  await page.goto("/w/test-studio/settings");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Software updates" }),
  ).toBeVisible();
  const review = page.getByRole("region", { name: "Documentation review" });
  await expect(
    review.getByRole("link", { name: /Unpublished checklist/ }),
  ).toBeVisible();
  await page.getByLabel("Review list", { exact: true }).selectOption("empty");
  await expect(
    review.getByRole("link", { name: /Unpublished checklist/ }),
  ).toBeVisible();
  await expect(review.getByRole("link", { name: /Public index/ })).toHaveCount(
    0,
  );
  await page.getByLabel("Review list", { exact: true }).selectOption("recent");
  await expect(
    review.getByRole("link", { name: /Public index/ }),
  ).toBeVisible();
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
  await expect(page).toHaveTitle("System · Test Studio · Lattice");
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
    page
      .locator(".audit-list")
      .getByText("Updated documentation settings", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".audit-list")
      .getByRole("listitem")
      .filter({ hasText: "viewer@example.test" })
      .getByText("Created an invitation", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: "New template", exact: true }).click();
  await page
    .getByLabel("Template name", { exact: true })
    .fill("Service runbook");
  await page
    .getByLabel("Template Markdown", { exact: true })
    .fill("## Recovery procedure\n\n- [ ] Confirm service health");
  await page
    .getByRole("button", { name: "Preview template", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Recovery procedure", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Service runbook", exact: true }),
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
  await page
    .getByLabel("Starting template", { exact: true })
    .selectOption({ label: "Service runbook" });
  await page.getByLabel("Page title", { exact: true }).fill("On-call runbook");
  await page.getByRole("button", { name: "Create page", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Recovery procedure", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: /^Drafts/ })
    .click();
  await expect(page).toHaveURL(/view=drafts$/);
  await expect(
    page.locator(".list-rows").getByRole("button", { name: /On-call runbook/ }),
  ).toBeVisible();
  await expect(
    page.locator(".list-rows").getByRole("button", { name: /Public index/ }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveTitle("Drafts · Test Studio · Lattice");
  await page.goto("/w/test-studio/settings?section=templates");
  await page
    .getByRole("button", { name: "Edit Service runbook", exact: true })
    .click();
  await page
    .getByLabel("Template name", { exact: true })
    .fill("Incident runbook");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete Incident runbook", exact: true })
    .click();
  await expect(
    page.getByText("No templates yet.", { exact: false }),
  ).toBeVisible();
  await request("/documentation", "PATCH", { show_toc: true });
  await page.goto("/w/test-studio");
  await page.getByRole("button", { name: "New page", exact: true }).click();
  await page.getByLabel("Import Markdown", { exact: true }).setInputFiles({
    name: "Imported-handbook.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "## **Install** the `SDK`\n\nImported knowledge.\n\n## Repeat\n\nFirst section.\n\n## Repeat\n\nSecond section.\n\n```md\n## Not a heading\n```\n\n<details><summary>Extra guidance</summary><p>Include this in print.</p></details>",
    ),
  });
  await expect(
    page.getByText("Ready to import Imported-handbook.md", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue(
    "Imported handbook",
  );
  await page.getByRole("button", { name: "Create page", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Imported handbook", exact: true }),
  ).toBeVisible();
  const outlineLinks = page.locator(".table-of-contents a");
  await expect(outlineLinks).toHaveCount(3);
  expect(
    await outlineLinks.evaluateAll((links) =>
      links.every(
        (link) =>
          !!document.getElementById(
            decodeURIComponent((link as HTMLAnchorElement).hash.slice(1)),
          ),
      ),
    ),
  ).toBe(true);
  await outlineLinks.last().click();
  await expect(page).toHaveURL(/#lattice-heading-repeat-1$/);
  await page.getByRole("button", { name: /^Appearance:/ }).click();
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await page.evaluate(() => {
    window.print = () => {
      window.dispatchEvent(new Event("beforeprint"));
    };
  });
  await page.getByLabel("More page actions", { exact: true }).click();
  await page
    .getByRole("button", { name: "Print / Save as PDF", exact: true })
    .click();
  await expect(page.locator(".prose details")).toHaveAttribute("open", "");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".topbar")).toBeHidden();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".prose pre")).toHaveCSS("white-space", "pre-wrap");
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator(".prose details")).not.toHaveAttribute("open");
  await page.goto("/w/test-studio");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const appearance = page.getByRole("button", {
    name: "Appearance: Dark",
    exact: true,
  });
  await appearance.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitemradio", { name: "Dark", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("menuitemradio", { name: "Light", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("menuitemradio", { name: "System", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(appearance).toBeFocused();
  await expect(
    page.getByRole("menu", { name: "Appearance", exact: true }),
  ).toHaveCount(0);
  await appearance.click();
  await page.getByRole("heading", { name: "Home", exact: true }).click();
  await expect(appearance).toHaveAttribute("aria-expanded", "false");
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
