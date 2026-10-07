"use client";
import type { Workspace } from "@/shared/types";
import { documentationSettings } from "@/shared/documentation";
import { api } from "@/client/api";

export function DocumentationPanel({
  workspace,
  run,
}: {
  workspace: Workspace;
  run: (fn: () => Promise<void>) => Promise<void>;
}) {
  const settings = documentationSettings(workspace.documentation);
  return (
    <form
      className="stack"
      key={JSON.stringify(settings)}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        void run(async () => {
          await api(`/api/w/${workspace.id}/documentation`, "PATCH", {
            default_state: form.get("default_state"),
            reading_width: form.get("reading_width"),
            footer_text: form.get("footer_text"),
            show_toc: form.has("show_toc"),
            show_author: form.has("show_author"),
            show_updated: form.has("show_updated"),
            show_reading_time: form.has("show_reading_time"),
          });
        });
      }}
    >
      <p className="muted">
        Set how documentation is created and displayed in this workspace.
        Existing page publication states stay as they are.
      </p>
      <label>
        Default publication state
        <select name="default_state" defaultValue={settings.default_state}>
          <option value="published">Published to workspace</option>
          <option value="draft">Draft (hidden from viewers)</option>
        </select>
      </label>
      <label>
        Reading width
        <select name="reading_width" defaultValue={settings.reading_width}>
          <option value="comfortable">Comfortable</option>
          <option value="wide">Wide, for tables and technical docs</option>
        </select>
      </label>
      <fieldset className="documentation-options stack">
        <legend>Page details</legend>
        {(
          [
            ["show_toc", "Show table of contents"],
            ["show_author", "Show author"],
            ["show_updated", "Show last updated date"],
            ["show_reading_time", "Show reading time"],
          ] as const
        ).map(([key, label]) => (
          <label className="checkbox-label" key={key}>
            <input type="checkbox" name={key} defaultChecked={settings[key]} />
            {label}
          </label>
        ))}
      </fieldset>
      <label>
        Footer text
        <input
          name="footer_text"
          defaultValue={settings.footer_text}
          maxLength={200}
        />
      </label>
      <p className="muted">
        Leave the footer text empty to hide the custom message. The open-source
        link stays available.
      </p>
      <button className="primary">Save documentation settings</button>
    </form>
  );
}
