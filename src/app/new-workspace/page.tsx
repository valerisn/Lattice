import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { NewWorkspace } from "@/components/new-workspace";
export default async function Page() { if (!await currentUser()) redirect("/login"); return <NewWorkspace />; }
