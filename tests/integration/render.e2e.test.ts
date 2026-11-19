import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApi } from "../../packages/api/src/index.ts";
import { HyperStudio } from "../../packages/sdk/src/index.ts";

// The whole path a client takes, for real: validate, compile, start a render through the REST API, wait for
// the job, and check the finished file. Needs Chrome, FFmpeg and time, so it is opt-in:  pnpm test:e2e
const enabled = process.env.HYPERSTUDIO_E2E === "1";

test("an SDK client renders a film through the API and gets the file back", {
  skip: !enabled && "set HYPERSTUDIO_E2E=1",
  timeout: 300_000,
}, async () => {
  const workspace = mkdtempSync(join(tmpdir(), "hs-render-"));
  cpSync(join(import.meta.dirname, "../../examples/saas-product-showcase"), join(workspace, "showcase"), {
    recursive: true,
    filter: (source) => !/\/(build|renders|product|\.tmp-[^/]*)(\/|$)/.test(source),
  });
  const key = "e2e-key-0123456789abcdef";
  const server = createApi({ workspace, apiKey: key });
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  try {
    const studio = new HyperStudio({
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      apiKey: key,
    });
    assert.equal((await studio.validate("showcase")).ok, true);
    assert.equal((await studio.compile("showcase")).ok, true);

    const first = await studio.renders.start("showcase", { quality: "draft", idempotencyKey: "one-render" });
    const again = await studio.renders.start("showcase", { quality: "draft", idempotencyKey: "one-render" });
    assert.equal(again.id, first.id, "the same idempotency key must not start a second render");

    const done = await studio.renders.wait(first.id, { everyMs: 1500 });
    assert.equal(done.state, "done", done.tail);
    assert.ok(existsSync(done.output));
    const file = await studio.renders.inspect("showcase");
    assert.equal(file.seconds, 17);
    assert.equal(file.matchesPlan, true);
    assert.equal(file.hasVideo, true);
  } finally {
    server.close();
  }
});
