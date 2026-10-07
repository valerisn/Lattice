import type { Metadata } from "next";
import { workspaceView } from "@/server/workspace-view";
import { firstParam, homepageId, pageViewTitle } from "@/shared/navigation";
import { WorkspaceApp } from "@/components/workspace-app";
import { Suspense } from "react";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[]; view?: string | string[] }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const data = await workspaceView((await params).slug);
  const query = await searchParams;
  const selected =
    firstParam(query.page) || homepageId(data.workspace, data.pages);
  const title = pageViewTitle(
    firstParam(query.view) || "page",
    data.pages.find((page) => page.id === selected),
    data.collections,
  );
  return { title: `${title} · ${data.workspace.name}` };
}
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const data = JSON.parse(
    JSON.stringify(await workspaceView((await params).slug)),
  );
  return (
    <Suspense
      fallback={
        <main className="welcome">
          <p>Loading workspace…</p>
        </main>
      }
    >
      <WorkspaceApp key={data.workspace.id} {...data} />
    </Suspense>
  );
}
