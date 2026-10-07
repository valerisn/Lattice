"use client";
import { useState } from "react";
import type { Workspace } from "@/shared/types";
import type { AdminData } from "./types";
import { api } from "@/client/api";

function InvitationLink({ url, email }: { url: string; email: string }) {
  const [copyState, setCopyState] = useState<
    "idle" | "copying" | "copied" | "failed"
  >("idle");
  return (
    <section
      className="settings-section stack"
      aria-label="Generated invitation"
    >
      <p>
        Invitation for <strong>{email}</strong>. Share this link with that
        person.
      </p>
      <label>
        Invitation link
        <input readOnly value={url} onFocus={(e) => e.target.select()} />
      </label>
      <div>
        <button
          type="button"
          disabled={copyState === "copying"}
          onClick={async () => {
            setCopyState("copying");
            try {
              await navigator.clipboard.writeText(url);
              setCopyState("copied");
            } catch {
              setCopyState("failed");
            }
          }}
        >
          {copyState === "copying" ? "Copying…" : "Copy invitation link"}
        </button>
      </div>
      <p className="muted" role="status">
        {copyState === "copied"
          ? "Invitation link copied."
          : copyState === "failed"
            ? "Could not copy the link. Select the link above and copy it manually, or try again."
            : "The link expires after seven days. No email has been sent."}
      </p>
    </section>
  );
}
export function MembersPanel({
  workspace,
  data,
  run,
}: {
  workspace: Workspace;
  data: AdminData;
  run: (fn: () => Promise<void>) => Promise<void>;
}) {
  const [invite, setInvite] = useState<{
    id: string;
    url: string;
    email: string;
  } | null>(null);
  const base = `/api/w/${workspace.id}`;
  return (
    <div className="stack">
      <div>
        <h2>The people behind the pages</h2>
        <p className="muted">
          Invite by email address, then share the generated link yourself. Links
          expire after seven days.
        </p>
      </div>
      <form
        className="invite-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = Object.fromEntries(new FormData(e.currentTarget));
          void run(async () => {
            const result = await api<{ id: string; url: string }>(
              `${base}/invites`,
              "POST",
              form,
            );
            setInvite({ ...result, email: String(form.email) });
          });
        }}
      >
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          Role
          <select name="role">
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
            {workspace.role === "owner" && <option value="admin">Admin</option>}
          </select>
        </label>
        <button type="submit" className="primary">
          Create invitation
        </button>
      </form>
      {invite && (
        <InvitationLink key={invite.id} url={invite.url} email={invite.email} />
      )}
      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.members.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.name}</strong>
                  <small>{m.email}</small>
                </td>
                <td>
                  <select
                    aria-label={`Role for ${m.name}`}
                    value={m.role}
                    disabled={
                      workspace.role !== "owner" &&
                      (m.role === "admin" || m.role === "owner")
                    }
                    onChange={(e) => {
                      const role = e.target.value;
                      void run(async () => {
                        await api(`${base}/members/${m.id}`, "PATCH", { role });
                      });
                    }}
                  >
                    {(workspace.role === "owner"
                      ? ["owner", "admin", "editor", "viewer"]
                      : [
                          "editor",
                          "viewer",
                          ...(m.role === "admin" || m.role === "owner"
                            ? [m.role]
                            : []),
                        ]
                    ).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{new Date(m.joined_at).toLocaleDateString()}</td>
                <td>
                  <button
                    className="danger"
                    disabled={
                      workspace.role !== "owner" &&
                      (m.role === "admin" || m.role === "owner")
                    }
                    onClick={() => {
                      if (
                        window.confirm(`Remove ${m.name} from this workspace?`)
                      )
                        void run(async () => {
                          await api(`${base}/members/${m.id}`, "DELETE");
                        });
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Invitations</h3>
      {data.invites.length ? (
        data.invites.map((i) => (
          <div className="row spread" key={i.id}>
            <span>
              {i.email}{" "}
              <small className="muted">
                · {i.role} ·{" "}
                {i.accepted_at
                  ? "Accepted"
                  : new Date(i.expires_at) < new Date()
                    ? "Expired"
                    : "Pending"}
              </small>
            </span>
            {!i.accepted_at && (
              <button
                onClick={() =>
                  run(async () => {
                    await api(`${base}/invites/${i.id}`, "DELETE");
                    setInvite((current) =>
                      current?.id === i.id ? null : current,
                    );
                  })
                }
              >
                Revoke
              </button>
            )}
          </div>
        ))
      ) : (
        <p className="muted">No invitations yet.</p>
      )}
    </div>
  );
}
