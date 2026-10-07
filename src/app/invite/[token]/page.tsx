import { currentUser } from "@/server/auth";
import { AuthForm } from "@/components/auth-form";
import { AcceptInvite } from "@/components/accept-invite";
export default async function InvitePage({params}:{params:Promise<{token:string}>}){const {token}=await params;const user=await currentUser();return user ? <AcceptInvite token={token} email={user.email}/> : <AuthForm inviteToken={token}/>;}
