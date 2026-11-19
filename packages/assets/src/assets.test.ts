import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  type Asset,
  createHttp,
  credits,
  downloadAsset,
  gate,
  listLocalAssets,
  providerStatus,
  RateLimitError,
  readLedger,
  usageSummary,
} from "./index.ts";

const tmp = () => mkdtempSync(join(tmpdir(), "hs-assets-"));
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const asset = (licence: string, extra: Partial<Asset> = {}): Asset => ({
  id: `openverse-audio:${licence}`,
  source: "openverse-audio",
  kind: "audio",
  title: "Quiet Room Tone",
  author: "A. Person",
  pageUrl: "https://example.test/sounds/1",
  fileUrl: "https://cdn.example.test/1.mp3",
  mediaType: "audio/mpeg",
  licence: { id: licence, version: "4.0", termsUrl: "https://creativecommons.org/licenses/" },
  gate: gate({ license: licence }),
  attribution: licence === "CC-BY" ? '"Quiet Room Tone" by A. Person, CC BY 4.0' : undefined,
  ...extra,
});
const fileFetch = async () =>
  new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } });

test("responses are cached for a day and every request is logged", async () => {
  const dir = tmp();
  let calls = 0;
  let time = 1_000_000;
  const http = createHttp({
    dir,
    now: () => time,
    fetch: () => {
      calls += 1;
      return Promise.resolve(json({ n: calls }));
    },
  });
  assert.deepEqual(await (await http("https://api.example.test/search?q=rain")).json(), { n: 1 });
  assert.deepEqual(await (await http("https://api.example.test/search?q=rain")).json(), { n: 1 });
  assert.equal(calls, 1, "the second request is served from cache");
  time += 25 * 60 * 60 * 1000;
  assert.deepEqual(await (await http("https://api.example.test/search?q=rain")).json(), { n: 2 });
  assert.deepEqual(usageSummary(dir), { "api.example.test": { network: 2, cached: 1 } });
});

test("the application names itself, and keys never reach the log", async () => {
  const dir = tmp();
  let agent = "";
  const http = createHttp({
    dir,
    fetch: (_url, init) => {
      agent = new Headers(init?.headers).get("user-agent") ?? "";
      return Promise.resolve(json({}));
    },
  });
  await http("https://pixabay.example.test/api/?key=SECRET123&q=sea");
  assert.match(agent, /^HyperStudio\//);
  const log = readFileSync(join(dir, "usage.jsonl"), "utf8");
  assert.doesNotMatch(log, /SECRET123/);
  assert.match(log, /key=REDACTED/);
});

test("a rate limit is an error that says how long to wait, not a retry loop", async () => {
  const http = createHttp({ dir: tmp(), fetch: async () => json({}, 429, { "retry-after": "30" }) });
  await assert.rejects(
    () => http("https://api.example.test/x"),
    (e: unknown) => e instanceof RateLimitError && e.retryAfterSec === 30 && e.host === "api.example.test",
  );
});

test("a provider without its key is skipped, never assumed", () => {
  const without = providerStatus({});
  assert.deepEqual(
    without.map((p) => [p.name, p.available]),
    [
      ["Openverse", true],
      ["Poly Haven", true],
      ["Pixabay", false],
    ],
  );
  assert.match(without[2]?.reason ?? "", /PIXABAY_API_KEY/);
  assert.equal(providerStatus({ PIXABAY_API_KEY: "k" })[2]?.available, true);
});

test("a download is recorded in the ledger with the credit it owes", async () => {
  const dir = tmp();
  const entry = await downloadAsset(asset("CC-BY"), dir, { fetch: fileFetch, today: "2026-11-19" });
  assert.equal(entry.file, "quiet-room-tone.mp3");
  assert.ok(existsSync(join(dir, entry.file)));
  assert.deepEqual(
    readLedger(dir).map((e) => [e.file, e.licence, e.verdict, e.downloadedOn]),
    [["quiet-room-tone.mp3", "CC-BY", "allowed-with-attribution", "2026-11-19"]],
  );
  assert.deepEqual(credits(dir), ['"Quiet Room Tone" by A. Person, CC BY 4.0']);
  // Downloading again replaces the entry instead of duplicating it.
  await downloadAsset(asset("CC-BY"), dir, { fetch: fileFetch, today: "2026-11-20" });
  assert.equal(readLedger(dir).length, 1);
});

test("the gate holds at download: refused, or accepted only by a person", async () => {
  const dir = tmp();
  await assert.rejects(() => downloadAsset(asset("CC-BY-NC"), dir, { fetch: fileFetch }), /non-commercial/);
  await assert.rejects(() => downloadAsset(asset("CC-BY-SA"), dir, { fetch: fileFetch }), /needs a person/);
  const entry = await downloadAsset(asset("CC-BY-SA"), dir, { fetch: fileFetch, acceptReview: true });
  assert.equal(entry.reviewed, true);
  await assert.rejects(
    () => downloadAsset(asset("CC0-1.0", { fileUrl: undefined }), dir, { fetch: fileFetch }),
    /no file that may be copied/,
  );
});

test("local files are listed with no network; ledger entries are attached", async () => {
  const dir = tmp();
  writeFileSync(join(dir, "logo.svg"), "<svg/>");
  writeFileSync(join(dir, "notes.txt"), "not media");
  await downloadAsset(asset("CC0-1.0"), dir, { fetch: fileFetch, name: "bed" });
  assert.deepEqual(
    listLocalAssets(dir).map((a) => [a.file, a.kind, a.ledger?.licence]),
    [
      ["bed.mp3", "audio", "CC0-1.0"],
      ["logo.svg", "image", undefined],
    ],
  );
});
