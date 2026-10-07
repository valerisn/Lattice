import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { AuthForm } from "@/components/auth-form";
export default async function Login() { if (await currentUser()) redirect("/"); return <AuthForm />; }
