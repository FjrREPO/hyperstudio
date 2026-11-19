import assert from "node:assert/strict";
import { test } from "node:test";
import { summarise } from "./motion.ts";

test("motion: still frames, the longest freeze and where it starts", () => {
  // Ten samples a second: half a second of movement, 1.2 s frozen, then movement again.
  const changes = [2, 2, 3, 2, 2, ...Array(12).fill(0.01), 4, 4, 4];
  const m = summarise(changes);
  assert.equal(m.stillPercent, 60);
  assert.deepEqual(m.longestStill, { seconds: 1.2, at: 0.5 });
  assert.equal(m.medianChange, 0.01);
  assert.deepEqual(summarise([]).longestStill, { seconds: 0, at: 0 });
});
