import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { compile, listRecipes } from "../../packages/compiler/src/index.ts";

// Every example in the repository must keep compiling, the same way every time.

const EXAMPLES = join(import.meta.dirname, "../../examples");
const names = readdirSync(EXAMPLES).filter((name) => existsSync(join(EXAMPLES, name, "video.json")));

test("there is an example for every documented video type", () => {
  assert.deepEqual(names.sort(), [
    "data-visualization",
    "kinetic-typography",
    "luxury-brand-commercial",
    "luxury-watch-commercial",
    "saas-product-launch",
    "social-short",
    "web3-protocol-promo",
  ]);
});

for (const name of names) {
  const ir = join(EXAMPLES, name, "video.json");

  test(`${name}: compiles to the length its IR states`, () => {
    const result = compile(ir, { validateOnly: true });
    const stated = JSON.parse(readFileSync(ir, "utf8")).project.duration;
    assert.equal(typeof stated, "number", "examples state project.duration so a timing change is caught");
    assert.equal(result.duration, stated);
    assert.equal(result.frames, Math.round(stated * result.fps));
  });

  test(`${name}: compiling twice gives identical files`, () => {
    const runs = [0, 1].map(() => {
      const out = mkdtempSync(join(tmpdir(), "hs-ex-"));
      return { out, files: compile(ir, { output: out }).files };
    });
    const [a, b] = runs;
    assert.ok(a && b);
    for (const f of a.files) assert.ok(readFileSync(join(a.out, f)).equals(readFileSync(join(b.out, f))), f);
  });
}

test("every recipe is used by at least one example", () => {
  const used = new Set(
    names.flatMap((name) =>
      compile(join(EXAMPLES, name, "video.json"), { validateOnly: true }).scenes.map((s) => s.recipe),
    ),
  );
  for (const recipe of listRecipes()) assert.ok(used.has(recipe.name), `${recipe.name} has no example`);
});
