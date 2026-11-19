#!/usr/bin/env node
// Synthesises the interface sounds for the benchmark film: key ticks while the question is typed, a click
// for each cursor click, a soft tone when the answer is shared and when the brand arrives.
// These are PLACEHOLDER sounds made from sine waves and noise. A published film needs real sound design.
// Usage: node assets/make-sfx.mjs   (needs ffmpeg) → assets/ui-sfx.m4a
import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RATE = 48000;
const LENGTH = 15;
const out = new Float32Array(RATE * LENGTH);
let seed = 20261119;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed / 2147483647) * 2 - 1;
};

/** Add a sound at `at` seconds: `wave(t)` shaped by an exponential decay. */
function add(at, length, decay, gain, wave) {
  const start = Math.round(at * RATE);
  for (let i = 0; i < length * RATE && start + i < out.length; i++) {
    const t = i / RATE;
    out[start + i] += gain * Math.exp(-t / decay) * wave(t);
  }
}
const sine = (hz) => (t) => Math.sin(2 * Math.PI * hz * t);
const tick = (at) => add(at, 0.03, 0.006, 0.16, (t) => random() * 0.6 + sine(2400 + random() * 500)(t) * 0.4);
const click = (at) => {
  add(at, 0.05, 0.008, 0.5, sine(1500));
  add(at, 0.09, 0.02, 0.4, sine(190));
};
const tone = (at, hz) => {
  add(at, 0.9, 0.22, 0.16, sine(hz));
  add(at, 0.9, 0.3, 0.1, sine(hz * 1.5));
};

// Timings follow video.json. If a shot's length changes there, change the matching time here.
for (let i = 0, t = 0.3; i < 36; i++, t += 0.04 + (random() + 1) * 0.0035) tick(t); // hook: the question is typed
click(4.79); // reveal: send
click(8.96); // share
tone(9.5, 660); // shared: link copied
tone(12.4, 440); // close: the brand arrives

const wav = Buffer.alloc(44 + out.length * 2);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + out.length * 2, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(RATE, 24);
wav.writeUInt32LE(RATE * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(out.length * 2, 40);
for (const [i, s] of out.entries())
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2);

const here = import.meta.dirname;
const tmp = join(here, "ui-sfx.wav");
writeFileSync(tmp, wav);
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-y",
  "-i",
  tmp,
  "-ac",
  "2",
  "-c:a",
  "aac",
  "-b:a",
  "128k",
  join(here, "ui-sfx.m4a"),
]);
rmSync(tmp);
