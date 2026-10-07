import { z } from "zod";
import type { Database } from "./db";
import { database } from "./db";
import { accountSchema, insertUser, createSession } from "./auth";
import { AppError } from "./errors";
import { canManage, type Workspace, type Role } from "@/shared/types";

export const workspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and hyphens.",
    )
    .min(2)
    .max(60),
});
export async function membership(
  db: Database,
  userId: string,
  workspaceId: string,
  action: "read" | "edit" | "manage" = "read",
) {
  const [workspace] = await db.query<Workspace>(
    "SELECT w.*,m.role FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE w.id=$1 AND m.user_id=$2",
    [workspaceId, userId],
  );
  if (!workspace) throw new AppError(404, "Workspace not found.");
  if (
    (action === "edit" && workspace.role === "viewer") ||
    (action === "manage" && !canManage(workspace.role))
  )
    throw new AppError(403, "You do not have permission to do that.");
  return workspace;
}
export async function listWorkspaces(db: Database, userId: string) {
  return db.query<Workspace>(
    "SELECT w.*,m.role FROM workspaces w JOIN workspace_members m ON w.id=m.workspace_id WHERE m.user_id=$1 ORDER BY w.created_at",
    [userId],
  );
}
export async function createWorkspace(
  db: Database,
  userId: string,
  data: z.infer<typeof workspaceSchema>,
) {
  const id = crypto.randomUUID();
  await db.query("INSERT INTO workspaces(id,name,slug) VALUES($1,$2,$3)", [
    id,
    data.name,
    data.slug,
  ]);
  await db.query(
    "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",
    [id, userId],
  );
  const collectionId = crypto.randomUUID();
  await db.query(
    "INSERT INTO collections(id,workspace_id,name,description) VALUES($1,$2,'Getting started','A little guidance for your first steps.')",
    [collectionId, id],
  );
  const pages = [
    {
      title: "Home",
      slug: "home",
      description:
        "A shared space for ideas, decisions, and everything worth keeping.",
      content: `# Welcome to ${data.name.replace(/[^\w\s-]/g, "")}\n\nGood knowledge deserves a place to grow. This is yours.\n\n## Make room for what matters\n\nLattice brings your team's guides, notes, and decisions together in one calm place. Start small. Write something useful. Let it grow.\n\n> The best documentation is the documentation someone actually writes.\n\n## A few things to try\n\n- Open **Getting Started** for a quick tour.\n- Create a page and give your next idea a home.\n- Organize related pages in a collection.\n- Invite someone to build this space with you.\n\n## Keep your knowledge connected\n\nUse nested pages for structure, favorites for the things you return to, and **Ctrl + K** to find your way.\n`,
    },
    {
      title: "Getting Started",
      slug: "getting-started",
      description: "Your first five minutes in Lattice.",
      content:
        "## Write something worth sharing\n\nChoose **New page**, add a title, and start writing. The editor supports headings, lists, code, tables, and Markdown shortcuts. Type `/` to insert a block.\n\n## Find your rhythm\n\n- [ ] Create your first page\n- [ ] Add a collection\n- [ ] Invite a teammate\n- [ ] Try dark mode\n\n## Your work is remembered\n\nEdits save automatically. Open **History** to inspect a previous version and restore it when needed.\n\n## Made to be yours\n\nLattice is self-hosted and open source. Your knowledge stays on your infrastructure.\n",
    },
    {
      title: "Welcome to Lattice",
      slug: "welcome-to-lattice",
      description: "Open knowledge, beautifully organized.",
      content:
        "## A home for what you know\n\nThis is a starter page. Edit it, make it your own, or delete it when you are ready.\n\n### A small example\n\n```typescript\nconst knowledge = {\n  open: true,\n  organized: true,\n  yours: true,\n};\n```\n\n| A place for | Examples |\n| --- | --- |\n| Your team | Onboarding, decisions, procedures |\n| Your project | Guides, architecture, API notes |\n| Yourself | Ideas, research, things to remember |\n",
    },
  ];
  let homeId = "";
  for (const [position, page] of pages.entries()) {
    const pageId = crypto.randomUUID();
    if (!position) homeId = pageId;
    await db.query(
      "INSERT INTO pages(id,workspace_id,collection_id,title,slug,description,content,position,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)",
      [
        pageId,
        id,
        position ? collectionId : null,
        page.title,
        page.slug,
        page.description,
        page.content,
        position,
        userId,
      ],
    );
    await db.query(
      "INSERT INTO page_revisions(id,page_id,version,title,description,content,editor_id,summary) VALUES($1,$2,1,$3,$4,$5,$6,'Created page')",
      [
        crypto.randomUUID(),
        pageId,
        page.title,
        page.description,
        page.content,
        userId,
      ],
    );
  }
  await db.query("UPDATE workspaces SET homepage_id=$1 WHERE id=$2", [
    homeId,
    id,
  ]);
  return id;
}
export async function setup(body: unknown) {
  const data = accountSchema
    .extend({
      workspaceName: workspaceSchema.shape.name,
      slug: workspaceSchema.shape.slug,
      setupToken: z.string().optional(),
    })
    .parse(body);
  if (process.env.NODE_ENV === "production" && !process.env.SETUP_TOKEN)
    throw new AppError(
      503,
      "The administrator must configure SETUP_TOKEN before setup.",
    );
  if (process.env.SETUP_TOKEN && data.setupToken !== process.env.SETUP_TOKEN)
    throw new AppError(403, "The installation setup token is incorrect.");
  const db = await database();
  const result = await db.transaction(async (tx) => {
    const [installation] = await tx.query<{ initialized: boolean }>(
      "SELECT initialized FROM installation WHERE id=1 FOR UPDATE",
    );
    if (installation.initialized)
      throw new AppError(409, "This installation is already set up.");
    const userId = await insertUser(tx, data);
    const workspaceId = await createWorkspace(tx, userId, {
      name: data.workspaceName,
      slug: data.slug,
    });
    await tx.query("UPDATE installation SET initialized=true WHERE id=1");
    return { userId, workspaceId };
  });
  await createSession(result.userId);
  return result;
}
export const roleRank: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};
