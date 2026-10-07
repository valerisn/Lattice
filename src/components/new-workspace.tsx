"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/client/api";
export function NewWorkspace() {
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const router=useRouter();
  return <main className="welcome"><img src="/lattice-logo.png" width="64" height="64" alt="Lattice" /><h1>A fresh space.</h1><p className="muted">Bring another project, team, or collection of ideas together.</p><form onSubmit={async e => { e.preventDefault(); setBusy(true); try { const data=await api<{slug:string}>("/api/workspaces","POST",Object.fromEntries(new FormData(e.currentTarget))); router.push(`/w/${data.slug}`); } catch(e){setError((e as Error).message);setBusy(false);} }}><label>Workspace name<input name="name" required maxLength={80}/></label><label>Workspace slug<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={60}/></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>Create workspace</button><Link href="/">Back to Lattice</Link></form></main>;
}
