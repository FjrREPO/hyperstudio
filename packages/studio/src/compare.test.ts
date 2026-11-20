import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { compareFilms, describe, readFilm } from "./compare.ts";

const example = (name: string) =>
  readFilm(join(import.meta.dirname, "../../../examples", name, "video.json"));

test("a film compared with itself shares every decision", () => {
  const film = example("marlow-launch-film");
  const same = compareFilms(film, film);
  assert.equal(same.shared, same.of);
});

test("it reports what two films share and where a third departs", () => {
  const lumen = example("saas-product-showcase");
  const marlow = example("marlow-launch-film");
  const relay = example("relay-deploy-film");
  const shared = (a: typeof lumen, b: typeof lumen) =>
    compareFilms(a, b)
      .rows.filter((r) => r.same)
      .map((r) => r.decision);
  // The reviewer's finding, as the tool reports it: the first two share a light stage and large type.
  for (const decision of ["stage", "film type"]) {
    assert.ok(shared(lumen, marlow).includes(decision), `Lumen and Marlow share ${decision}`);
    assert.ok(!shared(lumen, relay).includes(decision), `Lumen and Relay differ in ${decision}`);
  }
  assert.equal(describe(relay)["film type"], "none on screen");
  assert.match(describe(relay).stage ?? "", /^dark/);
});
