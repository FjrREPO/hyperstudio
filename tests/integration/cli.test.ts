import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// The CLI as a user runs it: a real process, real files, JSON on stdout, exit codes.

const ROOT = join(import.meta.dirname, "../..");
const CLI = join(ROOT, "packages/cli/src/cli.ts");
const EXAMPLE = join(ROOT, "examples/luxury-watch-commercial/video.json");
const run = (...args: string[]) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
};

test("compile writes a complete HyperFrames project", () => {
  const out = mkdtempSync(join(tmpdir(), "hs-cli-"));
  const r = run("compile", EXAMPLE, "--output", out);
  assert.equal(r.code, 0, r.err);
  const result = JSON.parse(r.out);
  assert.equal(result.ok, true);
  assert.equal(result.output, out);
  for (const f of [...result.files, "hyperframes.json", "package.json"])
    assert.ok(existsSync(join(out, f)), f);

  const index = readFileSync(join(out, "index.html"), "utf8");
  assert.match(index, /data-composition-id="main"[^>]*data-duration="16.2"/);
  assert.equal(index.match(/data-composition-src="compositions\//g)?.length, 3);
  assert.match(index, /<audio id="bed" class="clip" src="assets\/night-bed.m4a"/);
  assert.match(index, /window.__timelines\["main"\] = tl/);
});

test("--validate-only reports timing and writes nothing", () => {
  const r = run("compile", EXAMPLE, "--validate-only");
  assert.equal(r.code, 0, r.err);
  const result = JSON.parse(r.out);
  assert.equal(result.output, null);
  assert.equal(result.frames, 486);
});

test("--pretty indents the same result", () => {
  const plain = run("compile", EXAMPLE, "--validate-only").out;
  const pretty = run("compile", EXAMPLE, "--validate-only", "--pretty").out;
  assert.ok(pretty.includes('\n  "ok": true'));
  assert.deepEqual(JSON.parse(pretty), JSON.parse(plain));
});

test("a rejected IR exits 1 with machine-readable errors", () => {
  const file = join(mkdtempSync(join(tmpdir(), "hs-cli-")), "bad.json");
  writeFileSync(
    file,
    JSON.stringify({
      project: { title: "x" },
      scenes: [{ id: "a", recipe: "luxury-product-reveal", duration: 5, params: { camera: "crane" } }],
    }),
  );
  const r = run("compile", file);
  assert.equal(r.code, 1);
  const result = JSON.parse(r.out);
  assert.equal(result.ok, false);
  const camera = result.errors.find((e: { path: string }) => e.path === "scenes.0.params.camera");
  assert.match(camera.message, /push-in, pull-out, orbit, pan, static/);
});

test("recipes lists every recipe with its variables", () => {
  const r = run("recipes");
  assert.equal(r.code, 0, r.err);
  const recipes = JSON.parse(r.out);
  const reveal = recipes.find((x: { name: string }) => x.name === "luxury-product-reveal");
  assert.deepEqual(reveal.required, ["product", "headline"]);
  assert.ok(reveal.variables.some((v: { id: string }) => v.id === "camera"));
});

test("usage errors exit 1 and --help exits 0", () => {
  assert.equal(run("compile").code, 1);
  assert.equal(run("frobnicate").code, 1);
  assert.equal(run("--help").code, 0);
});
