import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { database } from "@/server/db";
import { listWorkspaces } from "@/server/workspaces";
import { accessContext } from "@/server/permissions";
import { WorkspaceApp } from "@/components/workspace-app";
export default async function WorkspacePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const user = await currentUser(); if (!user) redirect("/login");
  const db = await database(); const { slug } = await params;
  const workspaces = await listWorkspaces(db, user.id); const workspace = workspaces.find(w => w.slug === slug); if (!workspace) notFound();
  const ctx = await accessContext(db, workspace, user.id);
  const data = JSON.parse(JSON.stringify({ user, workspace, workspaces, pages: ctx.pages.filter(p => ctx.allowed(p)), collections: ctx.collections.filter(c => ctx.allowedCollection(c.id)), editableIds: ctx.pages.filter(p => ctx.allowed(p,"edit")).map(p => p.id) }));
  return <WorkspaceApp key={workspace.id} {...data} initialPageId={(await searchParams).page} />;
}
