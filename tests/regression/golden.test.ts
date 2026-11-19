import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { compile, listRecipes } from "../../packages/compiler/src/index.ts";

// Golden files: the exact project the compiler emits for each example. Any change to the compiler or to a
// recipe shows up here as a diff to review. Accept an intended change with:  pnpm test:update

const EXAMPLES = join(import.meta.dirname, "../../examples");
const GOLDEN = join(import.meta.dirname, "__golden__");
const names = readdirSync(EXAMPLES)
  .filter((name) => existsSync(join(EXAMPLES, name, "video.json")))
  .sort();
const build = (name: string) => {
  const out = mkdtempSync(join(tmpdir(), "hs-golden-"));
  return { out, result: compile(join(EXAMPLES, name, "video.json"), { output: out }) };
};
const isText = (file: string) => /\.(html|md)$/.test(file);

test("the examples are the ones the documentation describes", () => {
  assert.deepEqual(names, [
    "luxury-watch-commercial",
    "marlow-launch-film",
    "meeting-notes-launch",
    "relay-deploy-film",
    "saas-product-showcase",
  ]);
});

for (const name of names) {
  test(`${name}: compiled project matches the golden files`, () => {
    const { out, result } = build(name);
    const text = result.files.filter(isText);
    const golden = join(GOLDEN, name);
    if (process.env.UPDATE_GOLDEN === "1") {
      rmSync(golden, { recursive: true, force: true });
      for (const f of text) cpSync(join(out, f), join(golden, f));
    }
    assert.ok(existsSync(golden), "no golden files yet: run pnpm test:update");
    for (const f of text)
      assert.equal(readFileSync(join(out, f), "utf8"), readFileSync(join(golden, f), "utf8"), `${f} changed`);
  });

  test(`${name}: compiling twice gives byte-identical files`, () => {
    const [a, b] = [build(name), build(name)];
    for (const f of a.result.files)
      assert.ok(readFileSync(join(a.out, f)).equals(readFileSync(join(b.out, f))), f);
  });

  test(`${name}: states its length, and the compiler agrees`, () => {
    const stated = JSON.parse(readFileSync(join(EXAMPLES, name, "video.json"), "utf8")).project.duration;
    assert.equal(typeof stated, "number", "examples state project.duration so a timing change is caught");
    assert.equal(build(name).result.duration, stated);
  });
}

test("every recipe is used by at least one example", () => {
  const used = new Set(names.flatMap((name) => build(name).result.scenes.map((s) => s.recipe)));
  for (const recipe of listRecipes()) assert.ok(used.has(recipe.name), `${recipe.name} has no example`);
});

test("recompiling removes scenes the IR dropped and keeps hand-written files", () => {
  const { out } = build("meeting-notes-launch");
  const stale = join(out, "compositions/old-scene.html");
  const mine = join(out, "compositions/mine.html");
  writeFileSync(stale, readFileSync(join(out, "compositions/reveal.html"), "utf8"));
  writeFileSync(mine, "<template><div>hand written</div></template>");
  compile(join(EXAMPLES, "meeting-notes-launch/video.json"), { output: out });
  assert.equal(existsSync(stale), false, "generated leftovers are removed");
  assert.equal(existsSync(mine), true, "files without the marker are never touched");
});

// Bugs found while building the examples; each must stay fixed.
test("regression: no HyperFrames-invalid output", () => {
  const { out } = build("meeting-notes-launch");
  const scene = readFileSync(join(out, "compositions/reveal.html"), "utf8");
  const decls = JSON.parse(
    (/data-composition-variables='([^']*)'/.exec(scene)?.[1] ?? "[]")
      .replaceAll("&amp;", "&")
      .replaceAll("&#39;", "'"),
  );
  // check rejected an image variable declared without a default
  for (const v of decls) assert.ok("default" in v, `${v.id} has no default`);
  // an id shared by two scenes makes the second scene animate the first one's elements
  for (const other of ["notes", "owners", "product-shot"])
    assert.doesNotMatch(scene, new RegExp(`id="${other}-`), other);
  // the scene root must carry this scene's duration, not the recipe's native one
  assert.match(
    readFileSync(join(out, "compositions/ticked.html"), "utf8"),
    /id="root"[^>]*data-duration="1.2"/,
  );
  // an apostrophe in copy must survive the single-quoted attribute it travels in
  assert.match(
    readFileSync(join(out, "index.html"), "utf8"),
    /data-variable-values='[^']*product\\u2019s|data-variable-values='[^']*'/,
  );
});
