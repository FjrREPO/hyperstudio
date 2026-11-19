import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// The CLI as a user runs it: a real process, real files, exit codes, and both output modes.

const ROOT = join(import.meta.dirname, "../..");
const CLI = join(ROOT, "packages/cli/src/cli.ts");
const EXAMPLE = join(ROOT, "examples/saas-product-showcase/video.json");
const run = (...args: string[]) => {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
};

test("compile writes a complete HyperFrames project", () => {
  const out = mkdtempSync(join(tmpdir(), "hs-cli-"));
  const r = run("compile", EXAMPLE, "--output", out, "--json");
  assert.equal(r.code, 0, r.err);
  const result = JSON.parse(r.out);
  assert.equal(result.ok, true);
  assert.equal(result.output, out);
  for (const f of [...result.files, "hyperframes.json", "package.json"])
    assert.ok(existsSync(join(out, f)), f);

  const index = readFileSync(join(out, "index.html"), "utf8");
  assert.match(index, /data-composition-id="main"[^>]*data-duration="15"/);
  assert.equal(index.match(/data-composition-src="compositions\//g)?.length, 9);
  assert.match(index, /<audio id="sfx" class="clip" src="assets\/ui-sfx.m4a"/);
  assert.match(index, /window.__timelines\["main"\] = tl/);
});

test("the default output is a readable summary", () => {
  const r = run("compile", EXAMPLE, "--validate-only");
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /✓ Lumen - 15 second product showcase/);
  assert.match(r.out, /9 shots \(average 1\.7s\)/);
  assert.match(r.out, /product-shot\s+hook/);
  assert.match(r.out, /Placeholders \(7\)/);
  assert.match(r.out, /Validated\. Nothing written\./);
});

test("--json and --pretty give the same machine-readable result", () => {
  const plain = run("compile", EXAMPLE, "--validate-only", "--json").out;
  const pretty = run("compile", EXAMPLE, "--validate-only", "--pretty").out;
  assert.ok(pretty.includes('\n  "ok": true'));
  assert.deepEqual(JSON.parse(pretty), JSON.parse(plain));
  assert.equal(JSON.parse(plain).output, null);
});

test("a rejected IR exits 1 and says where the mistake is", () => {
  const ir = JSON.parse(readFileSync(EXAMPLE, "utf8"));
  ir.screens = {};
  ir.audio = [];
  ir.scenes = [
    {
      id: "a",
      recipe: "statement",
      duration: 2,
      purpose: "Say the one thing the film is about.",
      text: { line1: "Hello." },
      params: { size: "huge" },
    },
  ];
  ir.project = { title: ir.project.title };
  const file = join(mkdtempSync(join(tmpdir(), "hs-cli-")), "bad.json");
  writeFileSync(file, JSON.stringify(ir));

  const json = run("compile", file, "--json");
  assert.equal(json.code, 1);
  const size = JSON.parse(json.out).errors.find((e: { path: string }) => e.path === "scenes.0.params.size");
  assert.match(size.message, /title, display/);

  const human = run("compile", file);
  assert.equal(human.code, 1);
  assert.match(human.out, /✗ 1 problem in/);
  assert.match(human.out, /scenes\.0\.params\.size/);
});

test("recipes lists every recipe and shows one in detail", () => {
  const list = JSON.parse(run("recipes", "--json").out);
  assert.deepEqual(
    list.map((r: { name: string }) => r.name),
    ["brand-close", "luxury-product-reveal", "product-shot", "statement"],
  );
  const one = run("recipes", "product-shot");
  assert.equal(one.code, 0, one.err);
  assert.match(one.out, /Shows a screen/);
  assert.match(one.out, /cursor\s+params/);
  assert.match(one.out, /accent\s+style/);
  assert.equal(run("recipes", "nope").code, 1);
});

test("help, version and usage errors", () => {
  assert.equal(run("--help").code, 0);
  assert.match(run("--version").out, /^\d+\.\d+\.\d+\n$/);
  assert.equal(run().code, 2);
  assert.equal(run("compile").code, 2);
  assert.equal(run("frobnicate").code, 2);
  assert.equal(run("compile", EXAMPLE, "--bogus").code, 2);
});

test("assets: the provider policy and local listing work with no network and no key", () => {
  const providers = JSON.parse(run("assets", "providers", "--json").out);
  assert.deepEqual(
    providers.providers.map((p: { name: string }) => p.name),
    ["Openverse", "Poly Haven", "Pixabay"],
  );
  assert.ok(providers.excluded.some((e: { name: string }) => e.name === "Freesound API"));

  const dir = mkdtempSync(join(tmpdir(), "hs-cli-assets-"));
  writeFileSync(join(dir, "logo.svg"), "<svg/>");
  writeFileSync(
    join(dir, "LICENSES.json"),
    JSON.stringify([
      {
        file: "bed.mp3",
        licence: "CC-BY",
        source: "openverse-audio",
        attribution: '"Bed" by A. Person, CC BY 4.0',
      },
    ]),
  );
  writeFileSync(join(dir, "bed.mp3"), "x");
  const listed = JSON.parse(run("assets", "list", dir, "--json").out);
  assert.deepEqual(
    listed.files.map((f: { file: string; kind: string }) => [f.file, f.kind]),
    [
      ["bed.mp3", "audio"],
      ["logo.svg", "image"],
    ],
  );
  assert.deepEqual(listed.credits, ['"Bed" by A. Person, CC BY 4.0']);
});

test("assets: usage errors are reported as such", () => {
  assert.equal(run("assets").code, 2);
  assert.equal(run("assets", "search").code, 2);
  assert.equal(run("assets", "search", "rain", "--kind", "smell").code, 2);
  assert.equal(run("assets", "download", "1").code, 2);
});

test("audio: providers, dry runs and a missing key never generate or spend", () => {
  const providers = JSON.parse(run("audio", "providers", "--json").out);
  assert.deepEqual(
    providers.map((p: { id: string; cost: string }) => [p.id, p.cost]),
    [
      ["local", "none"],
      ["system", "none"],
      ["elevenlabs", "plan-credits"],
    ],
  );
  const dry = JSON.parse(
    run("audio", "tts", "Hello there.", "--provider", "elevenlabs", "--out", "x.mp3", "--dry-run", "--json")
      .out,
  );
  assert.equal(dry.wouldUse, "12 credits");

  const noKey = spawnSync(
    process.execPath,
    [
      CLI,
      "audio",
      "tts",
      "Hello.",
      "--provider",
      "elevenlabs",
      "--voice",
      "v1",
      "--out",
      join(tmpdir(), "hs-none.mp3"),
    ],
    {
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1", ELEVENLABS_API_KEY: "" },
    },
  );
  assert.equal(noKey.status, 1);
  assert.match(noKey.stderr, /ELEVENLABS_API_KEY is not set.*nothing was spent/);
});

test("audio: inspect reads a real file, and usage errors are reported as such", () => {
  const info = JSON.parse(
    run("audio", "inspect", join(ROOT, "examples/saas-product-showcase/assets/ui-sfx.m4a"), "--json").out,
  );
  assert.equal(Math.round(info.seconds), 15);
  assert.equal(info.codec, "aac");
  assert.equal(run("audio").code, 2);
  assert.equal(run("audio", "tts").code, 2);
  assert.equal(run("audio", "dub", "x.mp4").code, 2);
});
