#!/usr/bin/env node
// Synthesises the interface sounds for the benchmark film: key ticks while the question is typed, a click
// for each cursor click, a soft tone when the answer is shared and when the brand arrives.
// These are PLACEHOLDER sounds made from sine waves and noise. A published film needs real sound design.
// Usage: node assets/make-sfx.mjs [light|dark]   (needs ffmpeg) → assets/ui-sfx.m4a or ui-sfx-dark.m4a
import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// One sound file per cut of the film. Timings follow the beats in video.json and video-dark.json:
// if a beat moves there, move the matching time here.
const FILMS = {
  light: {
    file: "ui-sfx.m4a",
    length: 14.7,
    typeFrom: 2.0,
    typeEvery: 0.042,
    send: 3.8,
    answer: 4.8,
    share: 8.4,
    close: 12.2,
  },
  dark: {
    file: "ui-sfx-dark.m4a",
    length: 15.6,
    typeFrom: 2.5,
    typeEvery: 0.039,
    send: 4.3,
    answer: 5.4,
    share: 11.5,
    close: 13.1,
  },
};
const film = FILMS[process.argv[2] ?? "light"];
if (!film) throw new Error(`unknown film; use one of: ${Object.keys(FILMS).join(", ")}`);

const RATE = 48000;
const LENGTH = film.length;
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
for (let i = 0, t = film.typeFrom; i < 36; i++, t += film.typeEvery) tick(t); // the question is typed
click(film.send); // send
tone(film.answer, 520); // the answer arrives
click(film.share); // share
tone(film.share + 0.12, 660); // link copied
tone(film.close, 440); // the brand arrives

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
const target = join(here, film.file);
writeFileSync(tmp, wav);
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", tmp, "-ac", "2", "-c:a", "aac", "-b:a", "128k", target]);
rmSync(tmp);
