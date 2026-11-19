import { relative, resolve } from "node:path";
import {
  audioProviderStatus,
  ConfirmationRequired,
  createElevenLabs,
  estimateDub,
  estimateTts,
  inspectAudio,
  MissingKeyError,
  QuotaError,
  spendSummary,
  systemVoiceover,
} from "@hyperstudio/audio";
import { bold, dim, green, printJson, red, table, yellow } from "../output.ts";

export interface AudioFlags {
  provider?: string;
  voice?: string;
  model?: string;
  lang?: string;
  out?: string;
  confirmCost: boolean;
  dryRun: boolean;
  json: boolean;
  pretty: boolean;
}

const stateDir = () => resolve(".hyperstudio");
const eleven = () => createElevenLabs({ stateDir: stateDir() });
const shown = (path: string) => relative(process.cwd(), resolve(path)) || ".";

/** `hyperstudio audio <sub> ...`: returns the process exit code. */
export async function runAudio(sub: string | undefined, args: string[], flags: AudioFlags): Promise<number> {
  try {
    switch (sub) {
      case "providers":
        return providers(flags);
      case "tts":
        return await tts(args.join(" "), flags);
      case "voices":
        return await voices(args.join(" "), flags);
      case "dub":
        return await dub(args[0], flags);
      case "inspect":
        return inspect(args[0], flags);
      case "status":
        return await status(args[0], flags);
      default:
        return fail("audio needs one of: providers, tts, voices, dub, inspect, status", 2);
    }
  } catch (error) {
    // Each of these means nothing was generated. Say so, and say what would change that.
    if (error instanceof MissingKeyError) return fail(error.message, 1);
    if (error instanceof QuotaError) return fail(`${error.message} No plan was changed.`, 1);
    if (error instanceof ConfirmationRequired)
      return fail(`${error.message}\n  Nothing was generated. Re-run with --confirm-cost to go ahead.`, 1);
    return fail((error as Error).message, 1);
  }
}

function providers(flags: AudioFlags): number {
  const status = audioProviderStatus();
  if (flags.json) {
    printJson(status, flags.pretty);
    return 0;
  }
  for (const p of status) {
    const cost = p.cost === "none" ? "no cost" : "uses plan credits";
    console.log(
      `${p.available ? green("✓") : yellow("–")} ${bold(p.name)}  ${dim(`${p.does.join(", ")} · ${cost}`)}${p.available ? "" : `  ${yellow(p.reason ?? "")}`}`,
    );
    console.log(`    Rights: ${p.rights}`);
    for (const note of p.notes) console.log(dim(`    · ${note}`));
    console.log();
  }
  console.log(
    dim("  Everything works without ElevenLabs. It is used only when you name it and its key is set."),
  );
  return 0;
}

async function tts(text: string, flags: AudioFlags): Promise<number> {
  if (!text) return fail("audio tts needs the text to speak", 2);
  if (!flags.out) return fail("audio tts needs --out <file>", 2);
  const provider = flags.provider ?? "system";
  if (provider === "system") {
    if (flags.dryRun) return say(flags, { provider, wouldUse: "no credits, no network" });
    const file = systemVoiceover({ text, out: resolve(flags.out), voice: flags.voice });
    const info = inspectAudio(file);
    return say(flags, {
      file: shown(file),
      seconds: info.seconds,
      provider,
      commercial: false,
      note: "Draft voice. Mark it as a placeholder; replace it before publishing.",
    });
  }
  if (provider !== "elevenlabs") return fail('--provider must be "system" or "elevenlabs"', 2);
  const model = flags.model ?? "eleven_multilingual_v2";
  const estimate = estimateTts(text, model);
  if (flags.dryRun)
    return say(flags, {
      provider,
      wouldUse: `${estimate.credits} credits`,
      listPriceUsd: estimate.usd,
      basis: estimate.basis,
    });
  if (!flags.voice)
    return fail("ElevenLabs needs --voice <voice id>; list them with: hyperstudio audio voices", 2);
  const result = await eleven().tts({
    text,
    voiceId: flags.voice,
    model,
    language: flags.lang,
    out: resolve(flags.out),
    confirm: flags.confirmCost,
  });
  const info = inspectAudio(result.file);
  return say(flags, {
    file: shown(result.file),
    seconds: info.seconds,
    provider,
    plan: result.rights.plan,
    creditsUsed: result.reused ? 0 : estimate.credits,
    reused: result.reused,
    commercial: result.rights.commercial,
    note: result.rights.note,
  });
}

async function voices(search: string, flags: AudioFlags): Promise<number> {
  const list = await eleven().voices(search || undefined);
  if (flags.json) printJson(list, flags.pretty);
  else
    console.log(
      table([
        ["voice id", "name", "category"].map(dim),
        ...list.map((v) => [v.id, v.name, v.category ?? ""]),
      ]),
    );
  return 0;
}

async function dub(file: string | undefined, flags: AudioFlags): Promise<number> {
  if (!file) return fail("audio dub needs a finished video or audio file", 2);
  if (!flags.lang) return fail("audio dub needs --lang <target language code>, for example id", 2);
  const info = inspectAudio(resolve(file));
  const estimate = estimateDub(info.seconds);
  if (flags.dryRun)
    return say(flags, {
      provider: "elevenlabs",
      sourceSeconds: info.seconds,
      listPriceUsd: estimate.usd,
      basis: estimate.basis,
    });
  const job = await eleven().dub({
    file: resolve(file),
    sourceSeconds: info.seconds,
    targetLang: flags.lang,
    confirm: flags.confirmCost,
  });
  return say(flags, {
    job: job.id,
    expectedSeconds: job.expectedSeconds,
    plan: job.rights.plan,
    commercial: job.rights.commercial,
    note: job.rights.note,
    next: `hyperstudio audio status ${job.id} --lang ${flags.lang} --out <file>`,
  });
}

function inspect(file: string | undefined, flags: AudioFlags): number {
  if (!file) return fail("audio inspect needs a file", 2);
  return say(flags, inspectAudio(resolve(file)));
}

async function status(job: string | undefined, flags: AudioFlags): Promise<number> {
  const spent = spendSummary(stateDir());
  if (!job) {
    const plan = process.env.ELEVENLABS_API_KEY ? await eleven().subscription() : undefined;
    return say(flags, {
      elevenlabs: plan
        ? {
            plan: plan.tier,
            creditsUsed: plan.used,
            creditsLimit: plan.limit,
            creditsLeft: plan.limit - plan.used,
          }
        : "not configured (ELEVENLABS_API_KEY is not set)",
      here: { generations: spent.generations, creditsUsed: spent.credits, repeatsAvoided: spent.reused },
    });
  }
  const state = await eleven().dubStatus(job);
  if (state.status === "dubbed" && flags.out && flags.lang) {
    const file = await eleven().dubDownload(job, flags.lang, resolve(flags.out));
    return say(flags, { ...state, file: shown(file) });
  }
  return say(flags, state);
}

/** Print a result: JSON when asked, otherwise one line per field. */
function say(flags: AudioFlags, result: object): number {
  if (flags.json) printJson(result, flags.pretty);
  else
    for (const [key, value] of Object.entries(result))
      console.log(`  ${dim(`${key}:`)} ${typeof value === "object" ? JSON.stringify(value) : value}`);
  return 0;
}

function fail(message: string, code: number): number {
  console.error(`${red("✗")} ${message}`);
  return code;
}
