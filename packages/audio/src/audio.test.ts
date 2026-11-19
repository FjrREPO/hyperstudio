import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  audioProviderStatus,
  ConfirmationRequired,
  createElevenLabs,
  estimateDub,
  estimateTts,
  MissingKeyError,
  QuotaError,
  spendSummary,
} from "./index.ts";

const tmp = () => mkdtempSync(join(tmpdir(), "hs-audio-"));
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A stand-in for the service: records what it was asked, and answers like the documented API. */
function service(plan: { tier: string; used: number; limit: number }) {
  const calls: { method: string; path: string; key: string | null; body?: string }[] = [];
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({
      method: init?.method ?? "GET",
      path: url.pathname + url.search,
      key: new Headers(init?.headers).get("xi-api-key"),
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    if (url.pathname === "/v1/user/subscription")
      return Promise.resolve(
        json({ tier: plan.tier, character_count: plan.used, character_limit: plan.limit }),
      );
    if (url.pathname.startsWith("/v1/text-to-speech/"))
      return Promise.resolve(new Response(new Uint8Array([7, 7, 7])));
    if (url.pathname === "/v2/voices")
      return Promise.resolve(json({ voices: [{ voice_id: "v1", name: "Rachel", category: "premade" }] }));
    return Promise.resolve(json({ detail: "not found" }, 404));
  };
  return {
    calls,
    fetch: fetch as typeof globalThis.fetch,
    generations: () => calls.filter((c) => c.path.startsWith("/v1/text-to-speech/")).length,
  };
}
const client = (svc: ReturnType<typeof service>, stateDir: string, key: string | undefined = "sk-test") =>
  createElevenLabs({
    stateDir,
    fetch: svc.fetch,
    env: key ? { ELEVENLABS_API_KEY: key } : {},
    today: "2026-11-19",
  });
const request = (out: string) => ({ text: "Ask your revenue a question.", voiceId: "v1", out });

test("without a key nothing is sent", async () => {
  const svc = service({ tier: "free", used: 0, limit: 10000 });
  await assert.rejects(() => client(svc, tmp(), "").tts(request(join(tmp(), "a.mp3"))), MissingKeyError);
  assert.equal(svc.calls.length, 0);
});

test("the Free plan generates inside its credits and marks the result non-commercial", async () => {
  const svc = service({ tier: "free", used: 100, limit: 10000 });
  const out = join(tmp(), "vo.mp3");
  const result = await client(svc, tmp()).tts(request(out));
  assert.ok(existsSync(out));
  assert.deepEqual([result.rights.plan, result.rights.commercial, result.reused], ["free", false, false]);
  assert.equal(result.estimate.credits, 28);
  const call = svc.calls.find((c) => c.method === "POST");
  assert.equal(call?.path, "/v1/text-to-speech/v1?output_format=mp3_44100_128");
  assert.equal(call?.key, "sk-test");
  assert.deepEqual(JSON.parse(call?.body ?? "{}"), {
    text: "Ask your revenue a question.",
    model_id: "eleven_multilingual_v2",
    voice_settings: {},
  });
});

test("the Free plan is never exceeded, and nothing is upgraded", async () => {
  const svc = service({ tier: "free", used: 9990, limit: 10000 });
  await assert.rejects(
    () => client(svc, tmp()).tts(request(join(tmp(), "a.mp3"))),
    (e: unknown) => e instanceof QuotaError && e.remaining === 10 && e.needed === 28,
  );
  assert.equal(svc.generations(), 0);
});

test("a paid plan asks before it spends", async () => {
  const svc = service({ tier: "creator", used: 0, limit: 100000 });
  const state = tmp();
  await assert.rejects(
    () => client(svc, state).tts(request(join(tmp(), "a.mp3"))),
    (e: unknown) =>
      e instanceof ConfirmationRequired && e.estimate.credits === 28 && /creator plan/.test(e.message),
  );
  assert.equal(svc.generations(), 0);
  const result = await client(svc, state).tts({ ...request(join(tmp(), "a.mp3")), confirm: true });
  assert.deepEqual([result.rights.plan, result.rights.commercial], ["creator", true]);
  assert.equal(svc.generations(), 1);
});

test("the same request is never generated twice", async () => {
  const svc = service({ tier: "creator", used: 0, limit: 100000 });
  const state = tmp();
  await client(svc, state).tts({ ...request(join(tmp(), "a.mp3")), confirm: true });
  const again = await client(svc, state).tts(request(join(tmp(), "b.mp3"))); // no confirm needed: nothing is spent
  assert.deepEqual([again.reused, again.estimate.credits, again.rights.plan], [true, 0, "creator"]);
  assert.equal(svc.generations(), 1);
  assert.deepEqual(spendSummary(state), { credits: 28, generations: 1, reused: 1 });
  assert.doesNotMatch(readFileSync(join(state, "audio-spend.jsonl"), "utf8"), /sk-test/);
});

test("an unreadable plan is treated as paid and non-commercial", async () => {
  const svc = service({ tier: "free", used: 0, limit: 10000 });
  const broken = ((input: string | URL | Request, init?: RequestInit) =>
    String(input).includes("/subscription")
      ? Promise.resolve(json({}, 500))
      : svc.fetch(input, init)) as typeof globalThis.fetch;
  const el = createElevenLabs({ stateDir: tmp(), fetch: broken, env: { ELEVENLABS_API_KEY: "k" } });
  await assert.rejects(() => el.tts(request(join(tmp(), "a.mp3"))), ConfirmationRequired);
  const result = await el.tts({ ...request(join(tmp(), "a.mp3")), confirm: true });
  assert.deepEqual([result.rights.plan, result.rights.commercial], ["unknown", false]);
});

test("estimates follow the published price list", () => {
  assert.deepEqual(
    [
      estimateTts("x".repeat(1000), "eleven_multilingual_v2").usd,
      estimateTts("x".repeat(1000), "eleven_flash_v2_5").usd,
    ],
    [0.08, 0.04],
  );
  assert.equal(estimateTts("abc", "some-future-model").approximate, true);
  assert.equal(estimateDub(90).usd, 0.75);
});

test("ElevenLabs is unavailable without its key; local audio is always available", () => {
  const without = audioProviderStatus({});
  assert.equal(without.find((p) => p.id === "local")?.available, true);
  assert.equal(without.find((p) => p.id === "elevenlabs")?.available, false);
  assert.equal(
    audioProviderStatus({ ELEVENLABS_API_KEY: "k" }).find((p) => p.id === "elevenlabs")?.available,
    true,
  );
});
