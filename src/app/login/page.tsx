import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { AuthForm } from "@/components/auth-form";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = next?.startsWith("/invite/") ? next : "/";
  if (await currentUser()) redirect(destination);
  return <AuthForm destination={destination} />;
}
