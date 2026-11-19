import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { kokoroProblem, kokoroVoiceover, setupKokoro } from "./kokoro.ts";
import { audioProviderStatus, defaultVoiceProvider } from "./providers.ts";

const empty = () => ({ HYPERSTUDIO_KOKORO_DIR: mkdtempSync(join(tmpdir(), "hs-kokoro-")) });

test("Kokoro is unavailable until its model is installed, and says how to install it", () => {
  const env = empty();
  assert.match(kokoroProblem(env) ?? "", /audio setup kokoro/);
  const status = audioProviderStatus(env).find((p) => p.id === "kokoro");
  assert.equal(status?.available, false);
  assert.equal(status?.cost, "none");
  // Without it, the default voice is the system draft voice, never a paid one.
  assert.equal(defaultVoiceProvider(env), "system");
  assert.throws(
    () => kokoroVoiceover({ text: "Hello.", out: join(env.HYPERSTUDIO_KOKORO_DIR, "x.m4a") }, env),
    /cannot run/,
  );
});

test("setup downloads only what is missing, from the pinned release", async () => {
  const env = empty();
  const asked: string[] = [];
  const fake = ((url: string | URL | Request) => {
    asked.push(String(url));
    return Promise.resolve(new Response(new Uint8Array(1_100_000)));
  }) as typeof fetch;
  const first = await setupKokoro(env, fake);
  assert.deepEqual(first.downloaded, ["kokoro-v1.0.fp16.onnx", "voices-v1.0.bin"]);
  assert.ok(
    asked.every((url) =>
      url.startsWith("https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/"),
    ),
  );
  assert.deepEqual((await setupKokoro(env, fake)).downloaded, [], "a second run downloads nothing");
});
