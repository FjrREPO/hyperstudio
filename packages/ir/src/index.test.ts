import assert from "node:assert/strict";
import { test } from "node:test";
import { ASPECT_RATIOS, IR } from "./index.ts";

const scene = { id: "intro", recipe: "luxury-product-reveal", duration: 5 };
const minimal = { project: { title: "T" }, scenes: [scene] };
const paths = (input: unknown) => {
  const r = IR.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

test("a minimal IR gets the documented defaults", () => {
  const ir = IR.parse(minimal);
  assert.equal(ir.project.fps, 30);
  assert.equal(ir.project.aspectRatio, "16:9");
  assert.deepEqual(ir.style, {});
  assert.deepEqual(ir.audio, []);
  assert.deepEqual(ir.scenes[0]?.assets, {});
  assert.equal(ir.scenes[0]?.transition, undefined);
});

test("transition and audio defaults", () => {
  const ir = IR.parse({
    ...minimal,
    scenes: [{ ...scene, transition: { type: "fade" } }],
    audio: [{ id: "bed", src: "a.m4a" }],
  });
  assert.equal(ir.scenes[0]?.transition?.duration, 0.6);
  assert.deepEqual(
    [ir.audio[0]?.start, ir.audio[0]?.volume, ir.audio[0]?.fadeIn, ir.audio[0]?.fadeOut],
    [0, 1, 0, 0],
  );
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
  assert.deepEqual(paths({ ...minimal, project: { title: "T", aspectRatio: "21:9" } }), [
    "project.aspectRatio",
  ]);
  assert.deepEqual(paths({ ...minimal, scenes: [{ ...scene, transition: { type: "wipe" } }] }), [
    "scenes.0.transition.type",
  ]);
  assert.deepEqual(paths({ ...minimal, audio: [{ id: "bed", src: "a.m4a", volume: 9 }] }), [
    "audio.0.volume",
  ]);
});

test("every aspect ratio maps to an even-sized canvas", () => {
  for (const [ratio, { width, height }] of Object.entries(ASPECT_RATIOS)) {
    const [w, h] = ratio.split(":").map(Number);
    assert.equal(width * (h ?? 0), height * (w ?? 0), ratio);
    assert.equal((width % 2) + (height % 2), 0, ratio);
  }
});
