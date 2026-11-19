import assert from "node:assert/strict";
import { test } from "node:test";
import { ASPECT_RATIOS, IR } from "./index.ts";

const sentence = "A full sentence about the film.";
const direction = Object.fromEntries(
  ["concept", "audience", "message", "tone", "palette", "typography", "motion", "pacing"].map((k) => [
    k,
    sentence,
  ]),
);
const scene = {
  id: "intro",
  recipe: "statement",
  duration: 2,
  purpose: "Say the one thing the film is about.",
};
const minimal = {
  project: { title: "T" },
  direction,
  brand: { name: "Acme", kind: "example" },
  scenes: [scene],
};
const paths = (input: unknown) => {
  const r = IR.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

test("a minimal IR gets the documented defaults", () => {
  const ir = IR.parse(minimal);
  assert.equal(ir.project.fps, 30);
  assert.equal(ir.project.aspectRatio, "16:9");
  assert.deepEqual([ir.style, ir.screens, ir.audio], [{}, {}, []]);
  assert.deepEqual([ir.scenes[0]?.assets, ir.scenes[0]?.sources], [{}, []]);
  assert.equal(ir.scenes[0]?.transition, undefined);
});

test("direction is required and every field is a sentence, not a keyword", () => {
  assert.deepEqual(paths({ ...minimal, direction: undefined }), ["direction"]);
  assert.deepEqual(paths({ ...minimal, direction: { ...direction, tone: "bold" } }), ["direction.tone"]);
  assert.deepEqual(paths({ ...minimal, direction: { ...direction, mood: sentence } }), ["direction"]);
});

test("every scene states its purpose", () => {
  assert.deepEqual(paths({ ...minimal, scenes: [{ ...scene, purpose: undefined }] }), ["scenes.0.purpose"]);
  assert.deepEqual(paths({ ...minimal, scenes: [{ ...scene, purpose: "intro" }] }), ["scenes.0.purpose"]);
});

test("brand says whether the product is real", () => {
  assert.deepEqual(paths({ ...minimal, brand: { name: "Acme" } }), ["brand.kind"]);
  assert.deepEqual(paths({ ...minimal, brand: { name: "Acme", kind: "fictional" } }), ["brand.kind"]);
});

test("screens and assets record where they came from", () => {
  const screen = {
    src: "a.png",
    width: 1440,
    height: 900,
    origin: "captured",
    regions: { bar: [0, 0, 10, 10] },
  };
  assert.deepEqual(paths({ ...minimal, screens: { home: screen } }), []);
  assert.deepEqual(paths({ ...minimal, screens: { home: { ...screen, origin: undefined } } }), [
    "screens.home.origin",
  ]);
  assert.deepEqual(paths({ ...minimal, screens: { home: { ...screen, regions: { bar: [0, 0, 0, 10] } } } }), [
    "screens.home.regions.bar.2",
  ]);
  const ir = IR.parse({
    ...minimal,
    scenes: [{ ...scene, assets: { mark: { src: "m.svg" } } }],
    audio: [{ id: "a", src: "a.m4a" }],
  });
  assert.deepEqual(ir.scenes[0]?.assets.mark, { src: "m.svg", origin: "supplied" });
  assert.equal(ir.audio[0]?.origin, "supplied");
});

test("unknown keys are rejected at every level", () => {
  assert.deepEqual(paths({ ...minimal, extra: 1 }), [""]);
  assert.deepEqual(paths({ ...minimal, project: { title: "T", colour: "red" } }), ["project"]);
  assert.deepEqual(paths({ ...minimal, scenes: [{ ...scene, motion: {} }] }), ["scenes.0"]);
});

test("ids, durations and enums are constrained", () => {
  assert.deepEqual(paths({ ...minimal, scenes: [{ ...scene, id: "Intro Scene" }] }), ["scenes.0.id"]);
  assert.deepEqual(paths({ ...minimal, scenes: [{ ...scene, duration: 0 }] }), ["scenes.0.duration"]);
  assert.deepEqual(paths({ ...minimal, scenes: [] }), ["scenes"]);
  assert.deepEqual(paths({ ...minimal, project: { title: "T", fps: 29.97 } }), ["project.fps"]);
  assert.deepEqual(paths({ ...minimal, scenes: [{ ...scene, transition: { type: "wipe" } }] }), [
    "scenes.0.transition.type",
  ]);
});

test("every aspect ratio maps to an even-sized canvas", () => {
  for (const [ratio, { width, height }] of Object.entries(ASPECT_RATIOS)) {
    const [w, h] = ratio.split(":").map(Number);
    assert.equal(width * (h ?? 0), height * (w ?? 0), ratio);
    assert.equal((width % 2) + (height % 2), 0, ratio);
  }
});
