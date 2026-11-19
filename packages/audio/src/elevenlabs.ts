import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { type Estimate, estimateDub, estimateTts } from "./cost.ts";

// ElevenLabs is a closed service with a Free plan and paid plans. Everything here is optional: it needs a
// key; it reads the account's plan and remaining credits before generating; on the Free plan it stays inside
// those credits and marks the result non-commercial; on a paid plan it asks first; it never upgrades
// anything and never generates the same request twice. The key is used only in request headers.
//
// Endpoints as documented at https://elevenlabs.io/docs/api-reference on 2026-11-19:
//   POST /v1/text-to-speech/{voice_id}      GET /v2/voices      GET /v1/user/subscription
//   POST /v1/dubbing                        GET /v1/dubbing/{dubbing_id}
// The dubbed-audio download page could not be read (HTTP 403), so that one path is unverified.

const API = "https://api.elevenlabs.io";
export const DEFAULT_MODEL = "eleven_multilingual_v2";

export class MissingKeyError extends Error {
  constructor() {
    super("ELEVENLABS_API_KEY is not set. ElevenLabs is optional; nothing was sent and nothing was spent.");
    this.name = "MissingKeyError";
  }
}

/** Thrown instead of spending on a paid plan: carries the estimate so the caller can show it and ask. */
export class ConfirmationRequired extends Error {
  readonly estimate: Estimate;

  constructor(estimate: Estimate, plan: string) {
    super(
      `This uses about ${estimate.credits ?? "?"} credits on the ${plan} plan (${estimate.what}; list price about $${estimate.usd}). Confirm to proceed.`,
    );
    this.name = "ConfirmationRequired";
    this.estimate = estimate;
  }
}

/** Thrown when a plan does not have the credits. Nothing is generated and nothing is upgraded. */
export class QuotaError extends Error {
  readonly needed: number;
  readonly remaining: number;

  constructor(needed: number, remaining: number, plan: string) {
    super(`The ${plan} plan has ${remaining} credits left and this needs ${needed}. Nothing was generated.`);
    this.name = "QuotaError";
    this.needed = needed;
    this.remaining = remaining;
  }
}

/** What may be done with generated audio, as far as the plan tells us. */
export interface Rights {
  plan: string;
  /** False on the Free plan and when the plan is unknown. */
  commercial: boolean;
  note: string;
}

const rightsFor = (plan: string | undefined): Rights =>
  plan === undefined
    ? {
        plan: "unknown",
        commercial: false,
        note: "The plan could not be read; treat the audio as non-commercial until you confirm your licence",
      }
    : plan === "free"
      ? {
          plan,
          commercial: false,
          note: "Free plan: no commercial licence. Use it for drafts and non-commercial films, with credit to ElevenLabs",
        }
      : {
          plan,
          commercial: true,
          note: "Paid plan: its commercial licence applies; check its terms and voice consent before publishing",
        };

export interface ElevenLabsOptions {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof globalThis.fetch;
  /** Where the generation cache and the spend log live. */
  stateDir: string;
  today?: string;
}

export interface TtsRequest {
  text: string;
  voiceId: string;
  model?: string;
  /** ISO 639-1. Ignored by models that detect language themselves. */
  language?: string;
  stability?: number;
  similarity?: number;
  style?: number;
  speed?: number;
  /** Where to write the audio. */
  out: string;
  /** The caller has seen the estimate and agrees to the cost. */
  confirm?: boolean;
}

export interface Spend {
  on: string;
  what: string;
  /** Plan credits used, when known. */
  credits?: number;
  plan?: string;
  reused: boolean;
  file?: string;
}

export function createElevenLabs(options: ElevenLabsOptions) {
  const env = options.env ?? process.env;
  const http = options.fetch ?? globalThis.fetch;
  const key = () => {
    const value = env.ELEVENLABS_API_KEY;
    if (!value) throw new MissingKeyError();
    return value;
  };
  const record = (spend: Spend) => {
    mkdirSync(options.stateDir, { recursive: true });
    appendFileSync(join(options.stateDir, "audio-spend.jsonl"), `${JSON.stringify(spend)}\n`);
  };
  const today = () => options.today ?? new Date().toISOString().slice(0, 10);
  const call = async (path: string, init: RequestInit = {}) => {
    const response = await http(`${API}${path}`, {
      ...init,
      headers: { "xi-api-key": key(), ...init.headers },
    });
    if (response.status === 401)
      throw new Error("ElevenLabs rejected the API key (401). Check ELEVENLABS_API_KEY.");
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      const quota = response.status === 429 || /quota_exceeded/.test(detail);
      throw new Error(
        `ElevenLabs ${quota ? "quota or rate limit reached" : `error ${response.status}`} on ${path}: ${detail}`,
      );
    }
    return response;
  };

  return {
    /** Voices on the account. Free to call. */
    async voices(
      search?: string,
    ): Promise<{ id: string; name: string; category?: string; labels?: Record<string, string> }[]> {
      const query = new URLSearchParams({ page_size: "50", ...(search ? { search } : {}) });
      const data = (await (await call(`/v2/voices?${query}`)).json()) as {
        voices: { voice_id: string; name: string; category?: string; labels?: Record<string, string> }[];
      };
      return data.voices.map((v) => ({
        id: v.voice_id,
        name: v.name,
        category: v.category,
        labels: v.labels,
      }));
    },

    /** Characters used and allowed this billing period. Free to call. */
    async subscription(): Promise<{ tier: string; used: number; limit: number }> {
      const data = (await (await call("/v1/user/subscription")).json()) as {
        tier: string;
        character_count: number;
        character_limit: number;
      };
      return { tier: data.tier, used: data.character_count, limit: data.character_limit };
    },

    /**
     * Generate a voiceover. On the Free plan it runs inside the remaining credits; on a paid plan it throws
     * ConfirmationRequired with the estimate unless `confirm` is set. It never exceeds a plan's credits, and
     * the same request is never generated twice: a repeat returns the audio already made.
     */
    async tts(
      request: TtsRequest,
    ): Promise<{ file: string; estimate: Estimate; reused: boolean; rights: Rights }> {
      const model = request.model ?? DEFAULT_MODEL;
      const estimate = estimateTts(request.text, model);
      const settings = {
        stability: request.stability,
        similarity_boost: request.similarity,
        style: request.style,
        speed: request.speed,
      };
      const fingerprint = createHash("sha256")
        .update(JSON.stringify([request.text, request.voiceId, model, request.language, settings]))
        .digest("hex");
      const cached = join(options.stateDir, "audio-cache", `${fingerprint}.mp3`);
      mkdirSync(dirname(request.out), { recursive: true });
      if (existsSync(cached)) {
        writeFileSync(request.out, readFileSync(cached));
        record({ on: today(), what: estimate.what, credits: 0, reused: true, file: basename(request.out) });
        const earlier = existsSync(`${cached}.json`)
          ? (JSON.parse(readFileSync(`${cached}.json`, "utf8")) as Rights)
          : rightsFor(undefined);
        return {
          file: request.out,
          estimate: { ...estimate, credits: 0, usd: 0 },
          reused: true,
          rights: earlier,
        };
      }
      key(); // a missing key is reported before anything else
      const plan = await this.subscription().catch(() => undefined);
      const rights = rightsFor(plan?.tier);
      const needed = estimate.credits ?? request.text.length;
      if (plan && plan.limit - plan.used < needed)
        throw new QuotaError(needed, plan.limit - plan.used, plan.tier);
      // The Free plan spends no money, so it may run inside its credits. Anything else needs a yes.
      if (plan?.tier !== "free" && !request.confirm) throw new ConfirmationRequired(estimate, rights.plan);
      const body = {
        text: request.text,
        model_id: model,
        ...(request.language ? { language_code: request.language } : {}),
        voice_settings: Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== undefined)),
      };
      const response = await call(
        `/v1/text-to-speech/${encodeURIComponent(request.voiceId)}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const audio = Buffer.from(await response.arrayBuffer());
      mkdirSync(dirname(cached), { recursive: true });
      writeFileSync(cached, audio);
      writeFileSync(`${cached}.json`, JSON.stringify(rights));
      writeFileSync(request.out, audio);
      record({
        on: today(),
        what: estimate.what,
        credits: needed,
        plan: rights.plan,
        reused: false,
        file: basename(request.out),
      });
      return { file: request.out, estimate, reused: false, rights };
    },

    /**
     * Start dubbing a finished film into another language. Billed per source minute: a paid plan needs
     * `confirm`; the Free plan's dubs are watermarked. Returns a job id to poll with `dubStatus`.
     */
    async dub(request: {
      file: string;
      sourceSeconds: number;
      targetLang: string;
      sourceLang?: string;
      confirm?: boolean;
    }): Promise<{ id: string; expectedSeconds: number; estimate: Estimate; rights: Rights }> {
      const estimate = estimateDub(request.sourceSeconds);
      key();
      const plan = await this.subscription().catch(() => undefined);
      const rights = rightsFor(plan?.tier);
      if (plan?.tier !== "free" && !request.confirm) throw new ConfirmationRequired(estimate, rights.plan);
      const form = new FormData();
      form.set("file", new Blob([readFileSync(request.file)]), basename(request.file));
      form.set("target_lang", request.targetLang);
      if (request.sourceLang) form.set("source_lang", request.sourceLang);
      // The Free plan's dubs are watermarked by the service; a paid plan asks for none.
      form.set("watermark", plan?.tier === "free" ? "true" : "false");
      const data = (await (await call("/v1/dubbing", { method: "POST", body: form })).json()) as {
        dubbing_id: string;
        expected_duration_sec: number;
      };
      record({
        on: today(),
        what: `${estimate.what} (${request.targetLang})`,
        plan: rights.plan,
        reused: false,
      });
      return { id: data.dubbing_id, expectedSeconds: data.expected_duration_sec, estimate, rights };
    },

    /** Where a dubbing job stands. Free to call. */
    async dubStatus(
      id: string,
    ): Promise<{ id: string; status: string; targetLanguages: string[]; error?: string }> {
      const data = (await (await call(`/v1/dubbing/${encodeURIComponent(id)}`)).json()) as {
        dubbing_id: string;
        status: string;
        target_languages?: string[];
        error?: string;
      };
      return {
        id: data.dubbing_id,
        status: data.status,
        targetLanguages: data.target_languages ?? [],
        error: data.error,
      };
    },

    /** Download a finished dub. Path unverified against the documentation (see the note at the top). */
    async dubDownload(id: string, lang: string, out: string): Promise<string> {
      const response = await call(`/v1/dubbing/${encodeURIComponent(id)}/audio/${encodeURIComponent(lang)}`);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, Buffer.from(await response.arrayBuffer()));
      return out;
    },
  };
}

/** What has been generated, the credits it used, and how often a repeat was avoided. */
export function spendSummary(stateDir: string): { credits: number; generations: number; reused: number } {
  const file = join(stateDir, "audio-spend.jsonl");
  const summary = { credits: 0, generations: 0, reused: 0 };
  if (!existsSync(file)) return summary;
  for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
    const spend = JSON.parse(line) as Spend;
    if (spend.reused) summary.reused += 1;
    else summary.generations += 1;
    summary.credits += spend.credits ?? 0;
  }
  return summary;
}
