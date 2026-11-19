import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { compile } from "../../packages/compiler/src/index.ts";

// Compiled output against the real HyperFrames CLI. Needs npx + network on first run, so it is opt-in:
//   pnpm test:e2e
const enabled = process.env.HYPERSTUDIO_E2E === "1";
const EXAMPLE = join(import.meta.dirname, "../../examples/luxury-watch-commercial/commercial.json");

test("compiled example passes `hyperframes lint`", { skip: !enabled && "set HYPERSTUDIO_E2E=1" }, () => {
  const out = mkdtempSync(join(tmpdir(), "hs-e2e-"));
  compile(EXAMPLE, { output: out });
  const r = spawnSync("npx", ["-y", "hyperframes", "lint", "--json"], { cwd: out, encoding: "utf8" });
  const report = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  assert.equal(report.errorCount ?? report.lint?.errorCount ?? 0, 0, r.stdout.slice(0, 2000));
  assert.equal(r.status, 0, r.stderr.slice(0, 2000));
});
