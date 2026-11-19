import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { USER_AGENT } from "./http.ts";
import type { AssetKind } from "./providers.ts";
import type { Asset } from "./search.ts";

// The ledger: LICENSES.json beside the files it describes. It is the record of what a film uses, under which
// licence, and what credit it owes. A file with no entry is the user's own, and its rights are theirs to know.

export const LEDGER = "LICENSES.json";

export interface LedgerEntry {
  file: string;
  title: string;
  author?: string;
  source: string;
  pageUrl: string;
  licence: string;
  licenceVersion?: string;
  termsUrl: string;
  status: string;
  verdict: string;
  /** The credit line owed, when one is. */
  attribution?: string;
  /** A person accepted a licence the gate would not pass automatically. */
  reviewed?: boolean;
  downloadedOn: string;
}

export function readLedger(dir: string): LedgerEntry[] {
  const file = join(dir, LEDGER);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as LedgerEntry[]) : [];
}

const EXTENSIONS: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "audio/flac": ".flac",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "asset";

export interface DownloadOptions {
  /** File name without extension. Default: from the title. */
  name?: string;
  /** A person has read the licence of an asset the gate marked needs-review, and accepts it. */
  acceptReview?: boolean;
  fetch?: typeof globalThis.fetch;
  today?: string;
}

/**
 * Download one asset into `dir` and record it in the ledger.
 * Refuses a denied asset, and a needs-review asset unless a person has accepted it.
 */
export async function downloadAsset(
  asset: Asset,
  dir: string,
  options: DownloadOptions = {},
): Promise<LedgerEntry> {
  if (asset.gate.verdict === "denied") throw new Error(`${asset.id} cannot be used: ${asset.gate.reason}`);
  if (asset.gate.verdict === "needs-review" && !options.acceptReview)
    throw new Error(
      `${asset.id} needs a person to read its licence first (${asset.gate.reason}): ${asset.pageUrl}`,
    );
  if (!asset.fileUrl) throw new Error(`${asset.id} has no file that may be copied; open ${asset.pageUrl}`);

  const response = await (options.fetch ?? globalThis.fetch)(asset.fileUrl, {
    headers: { "user-agent": USER_AGENT },
  });
  if (!response.ok) throw new Error(`download failed (${response.status}) for ${asset.fileUrl}`);
  const type = (response.headers.get("content-type") ?? asset.mediaType ?? "").split(";")[0] ?? "";
  const extension = EXTENSIONS[type] ?? (extname(new URL(asset.fileUrl).pathname) || ".bin");
  const file = `${slug(options.name ?? asset.title)}${extension}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), Buffer.from(await response.arrayBuffer()));

  const entry: LedgerEntry = {
    file,
    title: asset.title,
    author: asset.author,
    source: asset.source,
    pageUrl: asset.pageUrl,
    licence: asset.licence.id,
    licenceVersion: asset.licence.version,
    termsUrl: asset.licence.termsUrl,
    status: asset.gate.status,
    verdict: asset.gate.verdict,
    attribution: asset.attribution,
    reviewed: asset.gate.verdict === "needs-review" ? true : undefined,
    downloadedOn: options.today ?? new Date().toISOString().slice(0, 10),
  };
  const ledger = [...readLedger(dir).filter((e) => e.file !== file), entry].sort((a, b) =>
    a.file.localeCompare(b.file),
  );
  writeFileSync(join(dir, LEDGER), `${JSON.stringify(ledger, null, 2)}\n`);
  return entry;
}

const KINDS: Record<string, AssetKind> = {
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".webp": "image",
  ".svg": "image",
  ".gif": "image",
  ".mp3": "audio",
  ".m4a": "audio",
  ".wav": "audio",
  ".ogg": "audio",
  ".flac": "audio",
  ".mp4": "video",
  ".webm": "video",
  ".mov": "video",
};

export interface LocalAsset {
  file: string;
  kind: AssetKind | "other";
  /** Its ledger entry, when it was downloaded through HyperStudio. */
  ledger?: LedgerEntry;
}

/** The media files in a folder. Works with no network and no provider. */
export function listLocalAssets(dir: string): LocalAsset[] {
  if (!existsSync(dir)) return [];
  const ledger = new Map(readLedger(dir).map((e) => [e.file, e]));
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name !== LEDGER && !d.name.startsWith("."))
    .map((d) => ({
      file: d.name,
      kind: KINDS[extname(d.name).toLowerCase()] ?? ("other" as const),
      ledger: ledger.get(d.name),
    }))
    .filter((a) => a.kind !== "other" || a.ledger !== undefined)
    .sort((a, b) => a.file.localeCompare(b.file));
}

/** The credit lines a folder's assets owe. */
export const credits = (dir: string): string[] =>
  readLedger(dir).flatMap((e) => (e.attribution ? [e.attribution] : []));
