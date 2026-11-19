import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// One fetch for every provider: it names the application, caches GET responses on disk, and logs each
// request. Caching keeps us inside providers' limits (Pixabay requires 24 hours); the log shows what was used.

export const USER_AGENT = "HyperStudio/0.2 (asset search)";
const DAY_MS = 24 * 60 * 60 * 1000;

export interface HttpOptions {
  /** Where the cache and the usage log live. */
  dir: string;
  /** How long a cached response is served, in milliseconds. Default: 24 hours. */
  ttlMs?: number;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}

export interface UsageEntry {
  at: string;
  host: string;
  path: string;
  status: number;
  cached: boolean;
}

/** Thrown when a provider says to slow down. Carries how long to wait when the provider says so. */
export class RateLimitError extends Error {
  readonly host: string;
  readonly retryAfterSec: number | undefined;

  constructor(host: string, retryAfterSec: number | undefined) {
    super(`${host} is rate limiting requests${retryAfterSec ? `; retry in ${retryAfterSec}s` : ""}`);
    this.name = "RateLimitError";
    this.host = host;
    this.retryAfterSec = retryAfterSec;
  }
}

interface Cached {
  savedAt: number;
  status: number;
  type: string;
  body: string;
}

/** Query-string secrets that must not reach the usage log or a cache file name. */
const redact = (url: URL) => {
  const copy = new URL(url);
  for (const name of ["key", "api_key", "apikey", "token", "access_token"])
    if (copy.searchParams.has(name)) copy.searchParams.set(name, "REDACTED");
  return copy;
};

export function createHttp(options: HttpOptions): typeof globalThis.fetch {
  const upstream = options.fetch ?? globalThis.fetch;
  const ttl = options.ttlMs ?? DAY_MS;
  const now = options.now ?? Date.now;
  const cacheDir = join(options.dir, "cache");
  mkdirSync(cacheDir, { recursive: true });
  const log = (entry: UsageEntry) =>
    appendFileSync(join(options.dir, "usage.jsonl"), `${JSON.stringify(entry)}\n`);

  return async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const method = (init?.method ?? "GET").toUpperCase();
    const safe = redact(url);
    const entry = { at: new Date(now()).toISOString(), host: url.host, path: safe.pathname + safe.search };
    const file = join(cacheDir, `${createHash("sha256").update(`${method} ${url.href}`).digest("hex")}.json`);

    if (method === "GET" && existsSync(file)) {
      const hit = JSON.parse(readFileSync(file, "utf8")) as Cached;
      if (now() - hit.savedAt < ttl) {
        log({ ...entry, status: hit.status, cached: true });
        return new Response(hit.body, { status: hit.status, headers: { "content-type": hit.type } });
      }
    }

    const headers = new Headers(init?.headers);
    if (!headers.has("user-agent")) headers.set("user-agent", USER_AGENT);
    const response = await upstream(url, { ...init, headers });
    log({ ...entry, status: response.status, cached: false });
    if (response.status === 429) {
      const wait = Number(response.headers.get("retry-after") ?? response.headers.get("x-ratelimit-reset"));
      throw new RateLimitError(url.host, Number.isFinite(wait) && wait > 0 ? wait : undefined);
    }
    const type = response.headers.get("content-type") ?? "";
    if (method === "GET" && response.ok && /json|text/.test(type)) {
      const body = await response.text();
      writeFileSync(
        file,
        JSON.stringify({ savedAt: now(), status: response.status, type, body } satisfies Cached),
      );
      return new Response(body, { status: response.status, headers: { "content-type": type } });
    }
    return response;
  };
}

/** Requests made, per host, split into those that reached the network and those served from cache. */
export function usageSummary(dir: string): Record<string, { network: number; cached: number }> {
  const file = join(dir, "usage.jsonl");
  const summary: Record<string, { network: number; cached: number }> = {};
  if (!existsSync(file)) return summary;
  for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
    const entry = JSON.parse(line) as UsageEntry;
    const host = summary[entry.host] ?? { network: 0, cached: 0 };
    if (entry.cached) host.cached += 1;
    else host.network += 1;
    summary[entry.host] = host;
  }
  return summary;
}
