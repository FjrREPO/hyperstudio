import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  type Asset,
  type AssetKind,
  credits,
  downloadAsset,
  EXCLUDED,
  listLocalAssets,
  providerStatus,
  RateLimitError,
  searchAssets,
  usageSummary,
} from "@hyperstudio/assets";
import { bold, clip, dim, green, printJson, red, table, yellow } from "../output.ts";

export interface AssetFlags {
  kind?: string;
  source?: string;
  limit?: string;
  to?: string;
  name?: string;
  heldBack: boolean;
  acceptReview: boolean;
  json: boolean;
  pretty: boolean;
}

/** Cache, usage log and the last search live here, in the directory the command is run from. */
const stateDir = () => resolve(".hyperstudio");
const lastSearch = () => join(stateDir(), "last-search.json");
const KINDS = ["image", "audio", "video"];
const mark = (asset: Asset) =>
  ({
    allowed: green("free"),
    "allowed-with-attribution": yellow("credit"),
    "needs-review": yellow("review"),
    denied: red("no"),
  })[asset.gate.verdict];

/** `hyperstudio assets <sub> ...`: returns the process exit code. */
export async function runAssets(sub: string | undefined, args: string[], flags: AssetFlags): Promise<number> {
  switch (sub) {
    case "providers":
      return providers(flags);
    case "search":
      return await search(args.join(" "), flags);
    case "download":
      return await download(args[0], flags);
    case "list":
      return list(args[0] ?? "assets", flags);
    case "usage":
      return usage(flags);
    default:
      console.error(`${red("✗")} assets needs one of: providers, search, download, list, usage`);
      return 2;
  }
}

function providers(flags: AssetFlags): number {
  const status = providerStatus();
  if (flags.json) {
    printJson({ providers: status, excluded: EXCLUDED }, flags.pretty);
    return 0;
  }
  for (const p of status) {
    console.log(
      `${p.available ? green("✓") : yellow("–")} ${bold(p.name)}  ${dim(p.kinds.join(", "))}${p.available ? "" : `  ${yellow(p.reason ?? "")}`}`,
    );
    console.log(`    Content: ${p.contentLicence}`);
    console.log(dim(`    Software: ${p.softwareLicence}`));
    for (const rule of p.rules) console.log(dim(`    · ${rule}`));
    console.log(dim(`    ${p.terms}\n`));
  }
  console.log(bold("Left out on purpose"));
  for (const e of EXCLUDED) console.log(`  ${e.name}: ${e.reason}`);
  console.log(
    dim(
      "\n  An open-source search tool does not make what it finds free to use. Every asset is gated by its own licence.",
    ),
  );
  return 0;
}

async function search(query: string, flags: AssetFlags): Promise<number> {
  const kind = flags.kind ?? "image";
  if (!query) return fail("assets search needs a query", 2);
  if (!KINDS.includes(kind)) return fail(`--kind must be one of: ${KINDS.join(", ")}`, 2);
  let result: Awaited<ReturnType<typeof searchAssets>>;
  try {
    result = await searchAssets({
      query,
      kind: kind as AssetKind,
      limit: flags.limit ? Number(flags.limit) : undefined,
      sources: flags.source?.split(","),
      includeHeldBack: flags.heldBack,
      stateDir: stateDir(),
    });
  } catch (error) {
    if (error instanceof RateLimitError)
      return fail(`${error.message}. Nothing was retried; try again later.`, 1);
    return fail((error as Error).message, 1);
  }
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(lastSearch(), JSON.stringify(result.assets, null, 2));
  if (flags.json) {
    printJson(result, flags.pretty);
    return 0;
  }
  if (result.assets.length === 0) console.log(`${yellow("–")} Nothing usable found for "${query}".`);
  else
    console.log(
      table([
        ["#", "use", "licence", "source", "length", "title", "by"].map(dim),
        ...result.assets.map((a, i) => [
          String(i + 1),
          mark(a) ?? "",
          a.licence.id + (a.licence.version ? ` ${a.licence.version}` : ""),
          a.source,
          a.durationSec ? `${Math.round(a.durationSec)}s` : a.width ? `${a.width}×${a.height}` : "",
          clip(a.title, 44),
          clip(a.author ?? "", 20),
        ]),
      ]),
    );
  if (result.heldBack > 0)
    console.log(
      dim(
        `\n  ${result.heldBack} more held back by the licence gate${flags.heldBack ? " (shown above, never picked automatically)" : "; --held-back shows them"}.`,
      ),
    );
  for (const u of result.unavailable) console.log(dim(`  ${u.name} skipped: ${u.reason}`));
  for (const s of result.sources.filter((s) => s.status !== "fulfilled" && s.reason !== "not-selected"))
    console.log(dim(`  ${s.id}: ${s.status}${s.reason ? ` (${s.reason})` : ""}`));
  if (result.assets.some((a) => a.source.startsWith("polyhaven")))
    console.log(dim("  Poly Haven results come from polyhaven.com."));
  console.log(
    dim("\n  Licence data comes from the source; confirm it on the asset's page before publishing."),
  );
  console.log(dim("  hyperstudio assets download <#> --to <film>/assets"));
  return 0;
}

async function download(pick: string | undefined, flags: AssetFlags): Promise<number> {
  if (!pick) return fail("assets download needs a result number or id from the last search", 2);
  if (!flags.to) return fail("assets download needs --to <dir>", 2);
  if (!existsSync(lastSearch())) return fail("run hyperstudio assets search first", 1);
  const results = JSON.parse(readFileSync(lastSearch(), "utf8")) as Asset[];
  const asset = /^\d+$/.test(pick) ? results[Number(pick) - 1] : results.find((a) => a.id === pick);
  if (!asset) return fail(`"${pick}" is not in the last search (${results.length} results)`, 1);
  try {
    const entry = await downloadAsset(asset, resolve(flags.to), {
      name: flags.name,
      acceptReview: flags.acceptReview,
    });
    if (flags.json) printJson(entry, flags.pretty);
    else {
      console.log(
        `${green("✓")} ${bold(join(relative(process.cwd(), resolve(flags.to)) || ".", entry.file))}  ${dim(`${entry.licence} · ${entry.source}`)}`,
      );
      console.log(entry.attribution ? `  Credit owed: ${entry.attribution}` : dim("  No credit required."));
      console.log(dim(`  Recorded in LICENSES.json. Confirm the licence at ${entry.pageUrl}`));
    }
    return 0;
  } catch (error) {
    return fail((error as Error).message, 1);
  }
}

function list(dir: string, flags: AssetFlags): number {
  const files = listLocalAssets(resolve(dir));
  const owed = credits(resolve(dir));
  if (flags.json) {
    printJson({ files, credits: owed }, flags.pretty);
    return 0;
  }
  if (files.length === 0) console.log(dim(`  No media in ${dir}.`));
  else
    console.log(
      table([
        ["file", "kind", "licence", "from"].map(dim),
        ...files.map((f) => [f.file, f.kind, f.ledger?.licence ?? "yours", f.ledger?.source ?? "local file"]),
      ]),
    );
  if (owed.length > 0) {
    console.log(`\n  ${bold("Credits owed")}`);
    for (const line of owed) console.log(`    ${line}`);
  }
  console.log(dim("\n  A file without a ledger entry is treated as your own; its rights are yours to know."));
  return 0;
}

function usage(flags: AssetFlags): number {
  const summary = usageSummary(stateDir());
  if (flags.json) {
    printJson(summary, flags.pretty);
    return 0;
  }
  const rows = Object.entries(summary);
  if (rows.length === 0) console.log(dim("  No requests recorded here yet."));
  else
    console.log(
      table([
        ["host", "network", "from cache"].map(dim),
        ...rows.map(([host, n]) => [host, String(n.network), String(n.cached)]),
      ]),
    );
  console.log(dim("\n  Every provider used is free. Nothing here can incur a charge."));
  return 0;
}

function fail(message: string, code: number): number {
  console.error(`${red("✗")} ${message}`);
  return code;
}
