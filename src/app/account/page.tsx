import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { AccountPanel } from "@/components/account-panel";
export default async function Page(){const user=await currentUser();if(!user)redirect("/login");return <AccountPanel user={JSON.parse(JSON.stringify(user))}/>;}
