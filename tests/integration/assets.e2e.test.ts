import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { autoSelectable, searchAssets } from "../../packages/assets/src/index.ts";

// Live searches against the free sources. Needs the network, so it is opt-in:  pnpm test:e2e
const enabled = process.env.HYPERSTUDIO_E2E === "1";
const skip = !enabled && "set HYPERSTUDIO_E2E=1";

test("Openverse audio: keyless, and every returned asset passed the licence gate", { skip }, async () => {
  const result = await searchAssets({
    query: "rain",
    kind: "audio",
    limit: 5,
    stateDir: mkdtempSync(join(tmpdir(), "hs-e2e-")),
  });
  assert.ok(result.assets.length > 0);
  for (const asset of result.assets) {
    assert.ok(autoSelectable(asset.gate), `${asset.id}: ${asset.gate.verdict}`);
    assert.match(asset.pageUrl, /^https:\/\//);
  }
});

test("Poly Haven: keyless, and everything is CC0", { skip }, async () => {
  const result = await searchAssets({
    query: "concrete",
    kind: "image",
    sources: ["polyhaven"],
    limit: 3,
    stateDir: mkdtempSync(join(tmpdir(), "hs-e2e-")),
  });
  assert.ok(result.assets.length > 0);
  for (const asset of result.assets) assert.equal(asset.gate.status, "cc0");
});
