import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { hyperframes } from "./review.ts";

// Stills cannot show whether a film moves. This renders a draft, measures how much of the picture changes
// from frame to frame, and cuts one dense strip per shot, so motion is reviewed from evidence too.

/** A frame differs from the one before it by less than this (mean absolute difference, 0-255): it is still. */
const STILL = 0.15;
const SAMPLE_FPS = 10;

export interface Motion {
  /** The draft render the numbers come from. */
  file: string;
  /** Share of sampled frames in which practically nothing changed, 0-100. */
  stillPercent: number;
  /** The longest run of still frames, in seconds, and where it starts. */
  longestStill: { seconds: number; at: number };
  /** Median change between sampled frames. Higher is busier. */
  medianChange: number;
  /** One strip per shot, eight frames a second. */
  strips: string[];
}

const ffmpeg = (args: string[]) =>
  spawnSync("ffmpeg", ["-v", "error", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/** Summarise per-frame change values. Exported for its test. */
export function summarise(changes: number[]): Pick<Motion, "stillPercent" | "longestStill" | "medianChange"> {
  const sorted = [...changes].sort((a, b) => a - b);
  let run = 0;
  let best = { frames: 0, start: 0 };
  changes.forEach((change, i) => {
    run = change < STILL ? run + 1 : 0;
    if (run > best.frames) best = { frames: run, start: i - run + 1 };
  });
  const still = changes.filter((c) => c < STILL).length;
  return {
    stillPercent: changes.length === 0 ? 0 : Math.round((still / changes.length) * 100),
    longestStill: { seconds: best.frames / SAMPLE_FPS, at: best.start / SAMPLE_FPS },
    medianChange: Number((sorted[Math.floor(sorted.length / 2)] ?? 0).toFixed(2)),
  };
}

/**
 * Render a draft of a compiled project and measure its motion.
 * @throws Error when the render fails or ffmpeg is not installed.
 */
export function measureMotion(
  build: string,
  scenes: { id: string; start: number; duration: number }[],
): Motion {
  const dir = join(build, ".hyperstudio");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "motion-draft.mp4");
  const render = hyperframes(build, ["render", "--quality", "draft", "-o", file]);
  if (render.status !== 0)
    throw new Error(`draft render failed: ${(render.stderr || render.stdout).slice(-300)}`);

  const filter = `fps=${SAMPLE_FPS},scale=160:90,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-`;
  const stats = ffmpeg(["-i", file, "-vf", filter, "-an", "-f", "null", "-"]);
  if (stats.error) throw new Error("ffmpeg is needed to measure motion and was not found");
  const changes = [...stats.stdout.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));

  const strips = scenes.map((scene, i) => {
    const strip = join(dir, `motion-${String(i + 1).padStart(2, "0")}-${scene.id}.jpg`);
    const columns = Math.min(8, Math.max(1, Math.ceil(scene.duration * 8)));
    const rows = Math.ceil((scene.duration * 8) / columns);
    ffmpeg([
      "-y",
      "-ss",
      String(scene.start),
      "-t",
      String(scene.duration),
      "-i",
      file,
      "-vf",
      `fps=8,scale=320:-2,tile=${columns}x${rows}`,
      "-frames:v",
      "1",
      strip,
    ]);
    return strip;
  });
  return { file, ...summarise(changes), strips };
}
