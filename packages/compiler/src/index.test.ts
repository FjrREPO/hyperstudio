import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { CompileError, compile, listRecipes } from "./index.ts";

const EXAMPLE_DIR = join(import.meta.dirname, "../../../examples/luxury-watch-commercial");
const EXAMPLE = join(EXAMPLE_DIR, "commercial.json");
const base = JSON.parse(readFileSync(EXAMPLE, "utf8"));

/** Compile a variation of the example and return the issue paths it is rejected with. */
function rejections(mutate: (ir: typeof base) => void): string[] {
  const ir = structuredClone(base);
  mutate(ir);
  // One folder below the example, so asset paths get one more "../".
  for (const scene of ir.scenes)
    for (const k of Object.keys(scene.assets ?? {})) scene.assets[k] = `../${scene.assets[k]}`;
  for (const a of ir.audio ?? []) a.src = `../${a.src}`;
  const file = join(mkdtempSync(join(EXAMPLE_DIR, ".tmp-")), "ir.json");
  writeFileSync(file, JSON.stringify(ir));
  try {
    compile(file, { validateOnly: true });
    return [];
  } catch (e) {
    assert.ok(e instanceof CompileError, String(e));
    return e.issues.map((i) => i.path);
  } finally {
    rmSync(dirname(file), { recursive: true });
  }
}

test("the example compiles with frame-accurate timing", () => {
  const r = compile(EXAMPLE, { validateOnly: true });
  assert.equal(r.duration, 16.2);
  assert.equal(r.frames, 486);
  // The crossfade into "calibre" overlaps the previous scene by 0.8s; the fades do not overlap.
  assert.deepEqual(
    r.scenes.map((s) => [s.id, s.start]),
    [
      ["reveal", 0],
      ["calibre", 5.2],
      ["closing", 10.2],
    ],
  );
});

test("one recipe used three times gets three isolated scenes", () => {
  const out = mkdtempSync(join(tmpdir(), "hs-c-"));
  compile(EXAMPLE, { output: out });
  const calibre = readFileSync(join(out, "compositions/calibre.html"), "utf8");
  assert.match(calibre, /data-composition-id="calibre"/);
  assert.match(calibre, /id="calibre-stage"/);
  assert.match(calibre, /data-duration="5"/);
  assert.doesNotMatch(calibre, /luxury-product-reveal/);
  assert.match(readFileSync(join(out, "index.html"), "utf8"), /data-variable-values='[^']*"camera":"orbit"/);
});

test("the IR is rejected where it is wrong, with the path to the mistake", () => {
  assert.deepEqual(
    rejections((ir) => void ir),
    [],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[0].params.glow = 2)),
    ["scenes.0.params.glow"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[0].params.camera = "crane")),
    ["scenes.0.params.camera"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[1].params.intensity = 9)),
    ["scenes.1.params.intensity"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[0].assets.product = "nope.png")),
    ["scenes.0.assets.product"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[0].text = { eyebrow: "x" })),
    ["scenes.0"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[0].recipe = "does-not-exist")),
    ["scenes.0.recipe", "project.duration"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[2].id = "reveal")),
    ["scenes.2.id"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[0].duration = 6.01)),
    ["scenes.0.duration"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[0].transition.type = "crossfade")),
    ["scenes.0.transition"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.style.neon = "#fff")),
    ["style.neon"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.project.duration = 30)),
    ["project.duration"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.surprise = true)),
    [""],
  );
});

test("every recipe declares defaults HyperFrames accepts", () => {
  const recipes = listRecipes();
  assert.ok(recipes.length > 0);
  for (const r of recipes)
    for (const v of r.variables) assert.notEqual(v.default, undefined, `${r.name}.${v.id} needs a default`);
});
