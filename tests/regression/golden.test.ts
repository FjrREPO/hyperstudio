import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { compile } from "../../packages/compiler/src/index.ts";

// Golden files: the exact project the compiler emits for the example. Any change to the compiler or to a
// recipe shows up here as a diff to review. Accept an intended change with:  pnpm test:update

const ROOT = join(import.meta.dirname, "../..");
const EXAMPLE = join(ROOT, "examples/luxury-watch-commercial/video.json");
const GOLDEN = join(import.meta.dirname, "__golden__/luxury-watch-commercial");
const TEXT = [
  "index.html",
  "compositions/reveal.html",
  "compositions/calibre.html",
  "compositions/closing.html",
];

const build = () => {
  const out = mkdtempSync(join(tmpdir(), "hs-golden-"));
  compile(EXAMPLE, { output: out });
  return out;
};

test("compiled example matches the golden project", () => {
  const out = build();
  if (process.env.UPDATE_GOLDEN === "1") {
    rmSync(GOLDEN, { recursive: true, force: true });
    for (const f of TEXT) cpSync(join(out, f), join(GOLDEN, f));
  }
  assert.ok(existsSync(GOLDEN), "no golden files yet: run pnpm test:update");
  for (const f of TEXT)
    assert.equal(readFileSync(join(out, f), "utf8"), readFileSync(join(GOLDEN, f), "utf8"), `${f} changed`);
  assert.deepEqual(readdirSync(join(out, "compositions")).sort(), [
    "calibre.html",
    "closing.html",
    "reveal.html",
  ]);
});

test("compiling twice gives byte-identical output", () => {
  const [a, b] = [build(), build()];
  for (const f of [...TEXT, "assets/noctis-one.svg", "assets/night-bed.m4a"])
    assert.ok(readFileSync(join(a, f)).equals(readFileSync(join(b, f))), f);
});

test("recompiling removes scenes the IR dropped and keeps hand-written files", () => {
  const out = build();
  const stale = join(out, "compositions/old-scene.html");
  const mine = join(out, "compositions/mine.html");
  writeFileSync(stale, readFileSync(join(out, "compositions/reveal.html"), "utf8"));
  writeFileSync(mine, "<template><div>hand written</div></template>");
  compile(EXAMPLE, { output: out });
  assert.equal(existsSync(stale), false, "generated leftovers are removed");
  assert.equal(existsSync(mine), true, "files without the marker are never touched");
});

// Bugs found while building the first example; each must stay fixed.
test("regression: no HyperFrames-invalid output", () => {
  const out = build();
  const scene = readFileSync(join(out, "compositions/reveal.html"), "utf8");
  const decls = JSON.parse(
    (/data-composition-variables='([^']*)'/.exec(scene)?.[1] ?? "[]")
      .replaceAll("&amp;", "&")
      .replaceAll("&#39;", "'"),
  );
  // check rejected an image variable declared without a default
  for (const v of decls) assert.ok("default" in v, `${v.id} has no default`);
  // an id shared by two scenes makes the second scene animate the first one's elements
  for (const other of ["calibre", "closing", "luxury-product-reveal"])
    assert.doesNotMatch(scene, new RegExp(`id="${other}-`), other);
  // the scene root must carry this scene's duration, not the recipe's native one
  assert.match(
    readFileSync(join(out, "compositions/calibre.html"), "utf8"),
    /id="root"[^>]*data-duration="5"/,
  );
});
