import { redirect } from "next/navigation";
import { database } from "@/server/db";
import { currentUser } from "@/server/auth";
import { listWorkspaces } from "@/server/workspaces";
import { AuthForm } from "@/components/auth-form";
export const dynamic = "force-dynamic";
export default async function Home() {
  const db = await database();
  const [installation] = await db.query<{ initialized: boolean }>("SELECT initialized FROM installation WHERE id=1");
  if (!installation.initialized) return <AuthForm setup tokenRequired={!!process.env.SETUP_TOKEN || process.env.NODE_ENV === "production"} />;
  const user = await currentUser();
  if (!user) redirect("/login");
  const [workspace] = await listWorkspaces(db, user.id);
  if (workspace) redirect(`/w/${workspace.slug}`);
  return <main className="welcome"><h1>You’re signed in.</h1><p>Open your invitation link to join a workspace.</p><a href="/new-workspace">Create a workspace</a></main>;
}
