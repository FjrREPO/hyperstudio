import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  type Asset,
  type AssetKind,
  credits,
  downloadAsset,
  listLocalAssets,
  providerStatus,
  searchAssets,
} from "@hyperstudio/assets";
import {
  audioProviderStatus,
  createElevenLabs,
  defaultVoiceProvider,
  estimateTts,
  inspectAudio,
  kokoroVoiceover,
  systemVoiceover,
} from "@hyperstudio/audio";
import { CompileError, type CompileResult, compile, type Issue, listRecipes } from "@hyperstudio/compiler";
import { IR } from "@hyperstudio/ir";
import { z } from "zod";
import { createJobs, type Quality } from "./jobs.ts";
import { reviewFilm } from "./review.ts";
import { createWorkspace, IR_FILE } from "./workspace.ts";

// The whole engine behind one object. The CLI, the MCP server, the REST API and the SDK all call this and
// add nothing of their own, so a film made through any of them is made the same way.

export interface StudioOptions {
  /** The workspace: a folder with one sub-folder per project. */
  root: string;
  env?: NodeJS.ProcessEnv;
}

/** A compile that either worked or says exactly why not. Never throws for a bad IR. */
export type Outcome = CompileResult | { ok: false; errors: Issue[] };

export function createStudio(options: StudioOptions) {
  const workspace = createWorkspace(options.root);
  const stateDir = join(workspace.root, ".hyperstudio");
  const jobs = createJobs(stateDir);
  const env = options.env ?? process.env;
  const irPath = (name: string) => join(workspace.projectDir(name), IR_FILE);
  const attempt = (name: string, validateOnly: boolean): Outcome => {
    try {
      return compile(irPath(name), { validateOnly });
    } catch (error) {
      if (error instanceof CompileError) return { ok: false, errors: error.issues };
      throw error;
    }
  };
  const recipes = () =>
    listRecipes().map((r) => ({
      name: r.name,
      title: r.title,
      description: r.description,
      minDuration: r.hyperstudio.minDuration,
      maxDuration: r.hyperstudio.maxDuration,
      required: r.hyperstudio.required,
      showsScreen: r.hyperstudio.screen,
      variables: r.variables.filter((v) => v.id !== "screen" && v.id !== "screenMeta"),
    }));

  return {
    workspace: workspace.root,

    projects: {
      list: () => workspace.list(),
      /** Make a project folder; with an IR, save and validate it in the same step. */
      create(name: string, ir?: unknown): { name: string; dir: string; plan?: Outcome } {
        const dir = workspace.create(name);
        if (ir === undefined) return { name, dir };
        workspace.writeIr(name, ir);
        return { name, dir, plan: attempt(name, true) };
      },
      /** Everything about a project: its IR, whether it compiles, its files and its renders. */
      get(name: string) {
        const dir = workspace.projectDir(name);
        const hasIr = existsSync(join(dir, IR_FILE));
        const rendersDir = join(dir, "renders");
        return {
          name,
          dir,
          ir: hasIr ? workspace.readIr(name) : null,
          plan: hasIr ? attempt(name, true) : null,
          assets: listLocalAssets(join(dir, "assets")),
          screens: listLocalAssets(join(dir, "screens")).map((a) => a.file),
          credits: credits(join(dir, "assets")),
          compiled: existsSync(join(dir, "build", "index.html")),
          renders: existsSync(rendersDir)
            ? readdirSync(rendersDir).filter((f) => /\.(mp4|webm|mov)$/.test(f))
            : [],
          reviewed: existsSync(join(dir, "REVIEW.md")),
        };
      },
      /** Replace a project's IR. It is saved even when invalid, so it can be fixed step by step. */
      saveIr(name: string, ir: unknown): Outcome {
        workspace.writeIr(name, ir);
        return attempt(name, true);
      },
    },

    recipes: {
      list: recipes,
      get(name: string) {
        const recipe = recipes().find((r) => r.name === name);
        if (!recipe)
          throw new Error(
            `no recipe named "${name}". Available: ${recipes()
              .map((r) => r.name)
              .join(", ")}`,
          );
        return recipe;
      },
    },

    /** The Creative IR's shape as JSON Schema: what a caller writes, so fields with defaults are optional. */
    schema: () => z.toJSONSchema(IR, { io: "input" }),

    validate: (name: string): Outcome => attempt(name, true),
    compile: (name: string): Outcome => attempt(name, false),
    /** Compile, run hyperframes check, snapshot every shot, start REVIEW.md. */
    review: (name: string) => reviewFilm(irPath(name)),

    renders: {
      /** Start a render in the background and return its job. */
      start(name: string, quality: Quality = "looks") {
        const dir = workspace.projectDir(name);
        return jobs.startRender(name, join(dir, "build"), join(dir, "renders", `${name}.mp4`), quality);
      },
      status: (id: string) => jobs.status(id),
      cancel: (id: string) => jobs.cancel(id),
      list: () => jobs.list(),
      /** A finished render checked against its plan: the file's real length beside the IR's. */
      inspect(name: string) {
        const file = join(workspace.projectDir(name), "renders", `${name}.mp4`);
        if (!existsSync(file)) throw new Error(`"${name}" has not been rendered yet`);
        const info = inspectAudio(file);
        const plan = attempt(name, true);
        const planned = plan.ok ? plan.duration : undefined;
        return {
          ...info,
          plannedSeconds: planned,
          matchesPlan: planned === undefined ? undefined : Math.abs(info.seconds - planned) < 0.05,
        };
      },
    },

    assets: {
      providers: () => providerStatus(env),
      search: (query: string, kind: AssetKind, limit?: number) =>
        searchAssets({ query, kind, limit, stateDir, env }),
      /** Download a search result into a project's assets folder and record its licence. */
      download: (name: string, asset: Asset, fileName?: string) =>
        downloadAsset(asset, join(workspace.projectDir(name), "assets"), { name: fileName }),
      list: (name: string) => {
        const dir = join(workspace.projectDir(name), "assets");
        return { files: listLocalAssets(dir), credits: credits(dir) };
      },
    },

    audio: {
      providers: () => audioProviderStatus(env),
      /** What a voiceover would use, without generating it. */
      estimate: (text: string, model = "eleven_multilingual_v2") => estimateTts(text, model),
      /** A voiceover into a project's assets. The system voice is free; ElevenLabs follows its plan rules. */
      async voiceover(
        name: string,
        request: {
          text: string;
          file: string;
          provider?: "kokoro" | "system" | "elevenlabs";
          voice?: string;
          language?: string;
          confirmCost?: boolean;
        },
      ) {
        const out = workspace.inside(
          name,
          join(
            "assets",
            `${request.file.replace(/[^a-z0-9-]/gi, "-")}.${request.provider === "elevenlabs" ? "mp3" : "m4a"}`,
          ),
        );
        if (request.provider === "elevenlabs") {
          if (!request.voice) throw new Error("ElevenLabs needs a voice id");
          const made = await createElevenLabs({ stateDir, env }).tts({
            text: request.text,
            voiceId: request.voice,
            language: request.language,
            out,
            confirm: request.confirmCost,
          });
          return {
            file: out,
            seconds: inspectAudio(out).seconds,
            provider: "elevenlabs",
            commercial: made.rights.commercial,
            note: made.rights.note,
            reused: made.reused,
          };
        }
        if ((request.provider ?? defaultVoiceProvider(env)) === "kokoro") {
          kokoroVoiceover({ text: request.text, out, voice: request.voice }, env);
          return {
            file: out,
            seconds: inspectAudio(out).seconds,
            provider: "kokoro",
            commercial: true,
            note: "Generated on this machine by an Apache 2.0 model. A synthetic voice: say so where disclosure is expected.",
            reused: false,
          };
        }
        systemVoiceover({ text: request.text, out, voice: request.voice });
        return {
          file: out,
          seconds: inspectAudio(out).seconds,
          provider: "system",
          commercial: false,
          note: "Draft voice: mark it as a placeholder and replace it before publishing.",
          reused: false,
        };
      },
      inspect: (name: string, file: string) => inspectAudio(workspace.inside(name, file)),
    },
  };
}

export type Studio = ReturnType<typeof createStudio>;
