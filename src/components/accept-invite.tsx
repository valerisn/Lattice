"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/client/api";
export function AcceptInvite({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <main className="welcome">
      <h1>A space for you, too.</h1>
      <p>Accept this workspace invitation as {email}.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="primary"
        onClick={async () => {
          setBusy(true);
          try {
            await api("/api/invites/accept", "POST", { token });
            router.push("/");
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        Join workspace
      </button>
    </main>
  );
}
