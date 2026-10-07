import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "./auth";
import { database } from "./db";
import { listWorkspaces } from "./workspaces";
import { accessContext } from "./permissions";

export const workspaceView = cache(async (slug: string) => {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = await database();
  const workspaces = await listWorkspaces(db, user.id);
  const workspace = workspaces.find((item) => item.slug === slug);
  if (!workspace) notFound();
  const context = await accessContext(db, workspace, user.id);
  return {
    user,
    workspace,
    workspaces,
    pages: context.pages.filter((page) => context.allowed(page)),
    collections: context.collections.filter((collection) =>
      context.allowedCollection(collection.id),
    ),
    editableIds: context.pages
      .filter((page) => context.allowed(page, "edit"))
      .map((page) => page.id),
  };
});
