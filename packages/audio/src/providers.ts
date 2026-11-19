import { spawnSync } from "node:child_process";

// Where a voice can come from. Free and local first; anything paid is optional and never chosen silently.

export interface AudioProviderInfo {
  id: "local" | "system" | "elevenlabs";
  name: string;
  does: ("voiceover" | "dubbing")[];
  /** What using it costs: nothing, or credits from a plan (which may be a free plan or a paid one). */
  cost: "none" | "plan-credits";
  /** Environment variable holding its key, when it needs one. */
  keyEnv?: string;
  /** What may be done with what it produces. */
  rights: string;
  notes: string[];
}

export const AUDIO_PROVIDERS: AudioProviderInfo[] = [
  {
    id: "local",
    name: "Local files",
    does: ["voiceover"],
    cost: "none",
    rights: "Yours: a recording you made or commissioned, or a file you hold the rights to",
    notes: [
      "Reference the file in the IR's audio list",
      "Free media can be found with: hyperstudio assets search --kind audio",
    ],
  },
  {
    id: "system",
    name: "System voice (macOS say)",
    does: ["voiceover"],
    cost: "none",
    rights:
      "Draft only. Built-in system voices are not licensed for published commercial work; treat the result as a placeholder",
    notes: ["For timing a film against narration before a real voice is recorded or generated", "macOS only"],
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    does: ["voiceover", "dubbing"],
    cost: "plan-credits",
    keyEnv: "ELEVENLABS_API_KEY",
    rights:
      "Set by your plan. The Free plan carries no commercial licence, so its output is marked non-commercial; a commercial licence starts at the Starter plan",
    notes: [
      "A closed service, not open source. It has a Free plan (10,000 credits a month) and paid plans",
      "Voiceover costs 1 credit per character; the estimate is shown before anything is generated",
      "On the Free plan it runs within the remaining credits and never beyond them",
      "On a paid plan it needs an explicit --confirm-cost",
    ],
  },
];

export interface AudioProviderStatus extends AudioProviderInfo {
  available: boolean;
  reason?: string;
}

const hasSay = () => process.platform === "darwin" && spawnSync("which", ["say"]).status === 0;

/** Which providers can be used right now. A missing key makes a provider unavailable; nothing falls back to it. */
export function audioProviderStatus(env: NodeJS.ProcessEnv = process.env): AudioProviderStatus[] {
  return AUDIO_PROVIDERS.map((p) => {
    if (p.keyEnv && !env[p.keyEnv]) return { ...p, available: false, reason: `set ${p.keyEnv} to enable it` };
    if (p.id === "system" && !hasSay()) return { ...p, available: false, reason: "needs macOS" };
    return { ...p, available: true };
  });
}
