import { buildAttribution, createRefkit, type Reference } from "@refkit/core";
import { createHttp } from "./http.ts";
import { autoSelectable, type Gate, gate } from "./license.ts";
import { type AssetKind, activeProviders, providerStatus } from "./providers.ts";

/** One found asset, with everything needed to decide on it and to credit it. */
export interface Asset {
  /** Stable id: `<source>:<id>`. */
  id: string;
  source: string;
  kind: AssetKind;
  title: string;
  author?: string;
  /** The asset's own page: where its licence is stated and can be confirmed. */
  pageUrl: string;
  /** The file to download, when the source allows a copy to be kept. */
  fileUrl?: string;
  mediaType?: string;
  durationSec?: number;
  width?: number;
  height?: number;
  licence: { id: string; version?: string; termsUrl: string };
  gate: Gate;
  /** The credit line to show when attribution is required. */
  attribution?: string;
}

export interface SearchOptions {
  query: string;
  kind: AssetKind;
  /** How many assets to return. Default 10. */
  limit?: number;
  /** Restrict to these source ids. */
  sources?: string[];
  /** Also return assets held back by the licence gate (never selected automatically). */
  includeHeldBack?: boolean;
  /** Where the cache and usage log live. */
  stateDir: string;
  env?: NodeJS.ProcessEnv;
  fetch?: typeof globalThis.fetch;
}

export interface SearchResult {
  assets: Asset[];
  /** Results the licence gate held back. */
  heldBack: number;
  /** Per-source outcome, as the search layer reported it. */
  sources: { id: string; status: string; reason?: string; returned?: number }[];
  /** Approved providers that could not be used, and why. */
  unavailable: { name: string; reason: string }[];
  warnings: string[];
}

const text = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);
const url = (value: unknown) => text((value as { url?: unknown } | undefined)?.url);
const positive = (value: unknown) => (typeof value === "number" && value > 0 ? value : undefined);

/** A search result in our shape. Only what the source stated is carried over. */
export function toAsset(ref: Reference, kind: AssetKind): Asset {
  const loose = ref as unknown as Record<string, { [key: string]: unknown } | undefined>;
  const decision = gate(ref.rights);
  const credit = buildAttribution({
    license: ref.rights.license,
    facts: ref.rights.facts,
    licenseVersion: ref.rights.licenseVersion,
    canonicalUrl: ref.canonicalUrl,
    author: ref.rights.author,
    title: ref.title,
  });
  // A copy may be kept only when the source allows it; otherwise there is a page to visit, not a file to take.
  const keepable = ref.rights.rehostPolicy === "cache-allowed";
  return {
    id: `${ref.source.id}:${ref.id}`,
    source: ref.source.id,
    kind,
    title: ref.title ?? "(untitled)",
    author: ref.rights.author,
    pageUrl: ref.canonicalUrl,
    fileUrl: keepable ? (url(loose.media) ?? url(loose.preview) ?? url(loose.thumbnail)) : undefined,
    mediaType: text(loose.preview?.mediaType),
    durationSec: positive(loose.audio?.durationSec) ?? positive(loose.video?.durationSec),
    width: positive(loose.visual?.width),
    height: positive(loose.visual?.height),
    licence: {
      id: String(ref.rights.license),
      version: ref.rights.licenseVersion,
      termsUrl: ref.rights.raw.sourceTerms,
    },
    gate: decision,
    attribution: credit.required || decision.attributionRequired ? credit.text : undefined,
  };
}

/** Rank by how free an asset is to use; the search layer's relevance order is kept within each rank. */
const freedom = (asset: Asset) =>
  ({ allowed: 0, "allowed-with-attribution": 1, "needs-review": 2, denied: 3 })[asset.gate.verdict];

/**
 * Search the approved free sources and gate every result for use in a commercial film.
 * A provider without its key is skipped and reported; it never fails the search.
 */
export async function searchAssets(options: SearchOptions): Promise<SearchResult> {
  const limit = options.limit ?? 10;
  const refkit = createRefkit({
    providers: activeProviders(options.env),
    fetch: createHttp({ dir: options.stateDir, fetch: options.fetch }),
  });
  const { references, meta } = await refkit.searchWithMeta({
    query: options.query,
    modalities: [options.kind],
    sources: options.sources,
    // Ask for more than needed: the gate removes some.
    limit: limit * 3,
  });
  const all = references.map((ref) => toAsset(ref, options.kind));
  const usable = all.filter((asset) => autoSelectable(asset.gate));
  const pool = options.includeHeldBack ? all : usable;
  return {
    assets: [...pool].sort((a, b) => freedom(a) - freedom(b)).slice(0, limit),
    heldBack: all.length - usable.length,
    sources: (meta.sources ?? [])
      .filter((s) => s.reason !== "unsupported-modality")
      .map((s) => ({ id: s.sourceId, status: s.status, reason: s.reason, returned: s.returned })),
    unavailable: providerStatus(options.env)
      .filter((p) => !p.available && p.kinds.includes(options.kind))
      .map((p) => ({ name: p.name, reason: p.reason ?? "unavailable" })),
    warnings: meta.warnings ?? [],
  };
}
