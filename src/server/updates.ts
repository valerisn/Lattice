import { compare, valid } from "semver";
import { z } from "zod";
import packageJson from "../../package.json";
import type { UpdateCheck } from "@/shared/updates";

export const installedVersion = packageJson.version;
const releasesUrl = "https://github.com/valerisn/Lattice/releases";
const releaseSchema = z.object({
  tag_name: z.string().max(100),
  draft: z.literal(false),
  prerelease: z.literal(false),
});

export async function fetchUpdate(
  fetcher: typeof fetch = fetch,
  installed = installedVersion,
): Promise<UpdateCheck> {
  const base = {
    installed,
    latest: null,
    releaseUrl: null,
    checkedAt: new Date().toISOString(),
  };
  try {
    const response = await fetcher(
      "https://api.github.com/repos/valerisn/Lattice/releases/latest",
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
          "User-Agent": "Lattice-update-checker",
        },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
        redirect: "error",
      },
    );
    if (response.status === 404)
      return {
        ...base,
        status: "unreleased",
        message: "No stable release is available from GitHub yet.",
      };
    if (!response.ok) throw new Error("Release service unavailable");
    const release = releaseSchema.parse(await response.json());
    const latest = valid(release.tag_name);
    if (!latest || !valid(installed))
      throw new Error("Invalid release version");
    const comparison = compare(latest, installed);
    return {
      ...base,
      latest,
      releaseUrl: `${releasesUrl}/tag/${encodeURIComponent(release.tag_name)}`,
      status:
        comparison > 0 ? "available" : comparison < 0 ? "ahead" : "current",
      message:
        comparison > 0
          ? "A newer stable release is available."
          : comparison < 0
            ? "Your installation is ahead of the latest stable release."
            : "You are running the latest stable release.",
    };
  } catch {
    return {
      ...base,
      status: "unavailable",
      message:
        "Could not check GitHub releases. Try again later or visit the releases page.",
    };
  }
}

let cached: UpdateCheck | null = null;
let pending: Promise<UpdateCheck> | null = null;

export function lastUpdateCheck() {
  return cached;
}

export async function checkForUpdates(): Promise<UpdateCheck> {
  // Share the cooldown across workspaces so administrators cannot exhaust GitHub's anonymous quota.
  if (cached && Date.now() - Date.parse(cached.checkedAt) < 5 * 60 * 1000)
    return cached;
  if (!pending)
    pending = fetchUpdate()
      .then((result) => (cached = result))
      .finally(() => {
        pending = null;
      });
  return pending;
}
