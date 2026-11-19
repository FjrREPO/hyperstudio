import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** What ffprobe reports about an audio (or video) file. */
export interface AudioInfo {
  file: string;
  seconds: number;
  codec?: string;
  channels?: number;
  sampleRate?: number;
  hasVideo: boolean;
}

/** Read a media file's real length and format. Needs ffprobe (it ships with FFmpeg). */
export function inspectAudio(file: string): AudioInfo {
  const probe = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,codec_name,channels,sample_rate",
      "-of",
      "json",
      file,
    ],
    {
      encoding: "utf8",
    },
  );
  if (probe.status !== 0) throw new Error(`cannot read ${file}: ${probe.stderr.trim() || "ffprobe failed"}`);
  const data = JSON.parse(probe.stdout) as {
    format?: { duration?: string };
    streams?: { codec_type: string; codec_name?: string; channels?: number; sample_rate?: string }[];
  };
  const audio = data.streams?.find((s) => s.codec_type === "audio");
  return {
    file,
    seconds: Number(Number(data.format?.duration ?? 0).toFixed(3)),
    codec: audio?.codec_name,
    channels: audio?.channels,
    sampleRate: audio?.sample_rate ? Number(audio.sample_rate) : undefined,
    hasVideo: data.streams?.some((s) => s.codec_type === "video") ?? false,
  };
}

/**
 * A draft voiceover from the operating system's own voice (macOS `say`), converted to AAC.
 * Free and offline. It is a placeholder for timing: system voices are not licensed for published
 * commercial work, and they do not sound like a recorded or generated voice.
 */
export function systemVoiceover(request: {
  text: string;
  out: string;
  voice?: string;
  rate?: number;
}): string {
  if (process.platform !== "darwin")
    throw new Error("the system voice needs macOS; use a local recording instead");
  mkdirSync(dirname(request.out), { recursive: true });
  const aiff = `${request.out}.aiff`;
  const say = spawnSync(
    "say",
    [
      ...(request.voice ? ["-v", request.voice] : []),
      ...(request.rate ? ["-r", String(request.rate)] : []),
      "-o",
      aiff,
      request.text,
    ],
    { encoding: "utf8" },
  );
  if (say.status !== 0) throw new Error(`say failed: ${say.stderr.trim()}`);
  const convert = spawnSync(
    "ffmpeg",
    ["-v", "error", "-y", "-i", aiff, "-c:a", "aac", "-b:a", "128k", request.out],
    { encoding: "utf8" },
  );
  spawnSync("rm", ["-f", aiff]);
  if (convert.status !== 0) throw new Error(`ffmpeg failed: ${convert.stderr.trim()}`);
  return request.out;
}
