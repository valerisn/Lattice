import type { Metadata } from "next";
import { workspaceView } from "@/server/workspace-view";
import { firstParam, adminSectionName } from "@/shared/navigation";
import { canManage } from "@/shared/types";
import { SettingsApp } from "@/components/admin/settings-app";
import { Suspense } from "react";
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ section?: string | string[] }>;
}): Promise<Metadata> {
  const { workspace } = await workspaceView((await params).slug);
  const section = adminSectionName(firstParam((await searchParams).section));
  return {
    title: `${canManage(workspace.role) ? section : "Administrator access required"} · ${workspace.name}`,
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const data = await workspaceView((await params).slug);
  const current = data.workspace;
  if (!canManage(current.role))
    return (
      <main className="welcome">
        <h1>Administrator access required</h1>
        <p>Your role does not allow workspace settings changes.</p>
      </main>
    );
  return (
    <Suspense
      fallback={
        <main className="welcome">
          <p>Loading workspace settings…</p>
        </main>
      }
    >
      <SettingsApp
        {...JSON.parse(
          JSON.stringify({
            workspace: current,
            pages: data.pages,
            collections: data.collections,
          }),
        )}
      />
    </Suspense>
  );
}
