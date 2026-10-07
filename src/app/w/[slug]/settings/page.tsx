import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/server/auth";
import { database } from "@/server/db";
import { listWorkspaces } from "@/server/workspaces";
import { accessContext } from "@/server/permissions";
import { canManage } from "@/shared/types";
import { SettingsApp } from "@/components/admin/settings-app";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = await database();
  const { slug } = await params;
  const current = (await listWorkspaces(db, user.id)).find(
    (w) => w.slug === slug,
  );
  if (!current) notFound();
  if (!canManage(current.role))
    return (
      <main className="welcome">
        <h1>Administrator access required</h1>
        <p>Your role does not allow workspace settings changes.</p>
      </main>
    );
  const ctx = await accessContext(db, current, user.id);
  return (
    <SettingsApp
      {...JSON.parse(
        JSON.stringify({
          workspace: current,
          pages: ctx.pages,
          collections: ctx.collections,
        }),
      )}
    />
  );
}
