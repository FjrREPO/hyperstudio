import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// Kokoro: an open-weight text-to-speech model (hexgrad/Kokoro-82M, Apache 2.0) run on this machine through
// kokoro-onnx (MIT). No key, no account, no network once its two files are in place. It is the default voice
// when it has been set up; setting it up is an explicit step, because it downloads about 190 MB.

/** Pinned: the runtime, and the release the model files come from. */
const RUNTIME = "kokoro-onnx==0.6.1";
const RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1";
export const KOKORO_FILES = [
  { name: "kokoro-v1.0.fp16.onnx", megabytes: 164 },
  { name: "voices-v1.0.bin", megabytes: 28 },
] as const;
export const KOKORO_DEFAULT_VOICE = "af_heart";

const SCRIPT = join(import.meta.dirname, "kokoro_tts.py");

/** Where the model lives: HYPERSTUDIO_KOKORO_DIR, or a cache folder in the home directory. */
export const kokoroDir = (env: NodeJS.ProcessEnv = process.env) =>
  env.HYPERSTUDIO_KOKORO_DIR ?? join(homedir(), ".cache", "hyperstudio", "kokoro");

const hasUv = () => spawnSync("uv", ["--version"], { encoding: "utf8" }).status === 0;

/** Why Kokoro cannot run right now, or null when it can. */
export function kokoroProblem(env: NodeJS.ProcessEnv = process.env): string | null {
  const dir = kokoroDir(env);
  const missing = KOKORO_FILES.filter(
    (f) => !(existsSync(join(dir, f.name)) && statSync(join(dir, f.name)).size > 1e6),
  );
  if (missing.length > 0)
    return "its model is not installed; run: hyperstudio audio setup kokoro (downloads about 190 MB)";
  if (!hasUv()) return "it needs uv to run Python (https://docs.astral.sh/uv)";
  return null;
}

/** Download the model files. Explicit and resumable: a file already present is left alone. */
export async function setupKokoro(
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
): Promise<{ dir: string; downloaded: string[] }> {
  const dir = kokoroDir(env);
  mkdirSync(dir, { recursive: true });
  const downloaded: string[] = [];
  for (const file of KOKORO_FILES) {
    const target = join(dir, file.name);
    if (existsSync(target) && statSync(target).size > 1e6) continue;
    const response = await fetcher(`${RELEASE}/${file.name}`);
    if (!response.ok) throw new Error(`download failed (${response.status}) for ${file.name}`);
    writeFileSync(target, Buffer.from(await response.arrayBuffer()));
    downloaded.push(file.name);
  }
  return { dir, downloaded };
}

/**
 * One line of narration from Kokoro, as AAC at a broadcast-style level.
 * @throws Error when Kokoro is not set up, the voice is unknown, or FFmpeg is missing.
 */
export function kokoroVoiceover(
  request: { text: string; out: string; voice?: string; speed?: number; language?: string },
  env: NodeJS.ProcessEnv = process.env,
): string {
  const problem = kokoroProblem(env);
  if (problem) throw new Error(`Kokoro cannot run: ${problem}`);
  const dir = kokoroDir(env);
  mkdirSync(dirname(request.out), { recursive: true });
  const wav = `${request.out}.wav`;
  const synth = spawnSync(
    "uv",
    [
      "run",
      "-q",
      "--python",
      "3.12",
      "--with",
      RUNTIME,
      "--with",
      "soundfile",
      "python",
      SCRIPT,
      join(dir, KOKORO_FILES[0].name),
      join(dir, KOKORO_FILES[1].name),
      wav,
      request.voice ?? KOKORO_DEFAULT_VOICE,
      String(request.speed ?? 1),
      request.language ?? "en-us",
    ],
    { input: request.text, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (synth.status !== 0) {
    rmSync(wav, { force: true });
    // The runtime prints harmless graph warnings; the last line is the one that says what went wrong.
    throw new Error(`Kokoro failed: ${(synth.stderr || synth.stdout).trim().split("\n").pop()}`);
  }
  // Level every line the same, so lines made at different times sit together in a mix.
  const convert = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-i",
      wav,
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      "-ar",
      "48000",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      request.out,
    ],
    { encoding: "utf8" },
  );
  rmSync(wav, { force: true });
  if (convert.status !== 0) throw new Error(`ffmpeg failed: ${convert.stderr.trim()}`);
  return request.out;
}
