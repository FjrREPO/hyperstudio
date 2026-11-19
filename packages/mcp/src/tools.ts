import { readFileSync } from "node:fs";
import type { Studio } from "@hyperstudio/studio";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Every tool is one call into @hyperstudio/studio. No film-making logic lives here.

type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
const reply = (data: unknown, extra: Content[] = []) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }, ...extra],
});
/** Run a tool body; a thrown error becomes a result the agent can read and act on. */
const run = async (body: () => unknown | Promise<unknown>, extra?: () => Content[]) => {
  try {
    return reply(await body(), extra?.());
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: `${(error as Error).name}: ${(error as Error).message}` }],
    };
  }
};

const project = z.string().describe("Project name: lowercase letters, digits and hyphens");
const readOnly = { readOnlyHint: true };

export function registerTools(server: McpServer, studio: Studio): void {
  // ── Projects ──
  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List the film projects in the workspace.",
      inputSchema: {},
      annotations: readOnly,
    },
    () => run(() => ({ workspace: studio.workspace, projects: studio.projects.list() })),
  );
  server.registerTool(
    "create_project",
    {
      title: "Create a project",
      description:
        "Create a film project folder (with assets/ and screens/). Pass `ir` to save a Creative IR at the same time; the reply then says whether it compiles. Read the hyperstudio://guide/direction resource before writing an IR.",
      inputSchema: {
        name: project,
        ir: z.record(z.string(), z.unknown()).optional().describe("A Creative IR document"),
      },
    },
    ({ name, ir }) => run(() => studio.projects.create(name, ir)),
  );
  server.registerTool(
    "get_project",
    {
      title: "Inspect a project",
      description:
        "A project's IR, whether it compiles (with the shot plan, placeholders, warnings and credits owed), its asset and screen files, and its renders.",
      inputSchema: { name: project },
      annotations: readOnly,
    },
    ({ name }) => run(() => studio.projects.get(name)),
  );
  server.registerTool(
    "save_ir",
    {
      title: "Save a project's Creative IR",
      description:
        "Replace a project's Creative IR and validate it. On failure the reply lists every problem with its path into the IR (for example scenes.2.params.to) and what is allowed. The IR is saved either way, so fix and save again.",
      inputSchema: {
        name: project,
        ir: z.record(z.string(), z.unknown()).describe("The complete Creative IR document"),
      },
    },
    ({ name, ir }) => run(() => studio.projects.saveIr(name, ir)),
  );

  // ── Recipes ──
  server.registerTool(
    "list_recipes",
    {
      title: "List shot recipes",
      description: "The shot recipes a scene can use, each with its length range and what it is for.",
      inputSchema: {},
      annotations: readOnly,
    },
    () =>
      run(() =>
        studio.recipes
          .list()
          .map(({ variables, ...recipe }) => ({ ...recipe, variableCount: variables.length })),
      ),
  );
  server.registerTool(
    "inspect_recipe",
    {
      title: "Inspect a recipe",
      description:
        "One recipe's variables: id, type, default, allowed values, and role. Variables with role `brand` are set once in the IR's style, never per scene; role `region` names a region of the scene's screen.",
      inputSchema: { name: z.string().describe("Recipe name, from list_recipes") },
      annotations: readOnly,
    },
    ({ name }) => run(() => studio.recipes.get(name)),
  );

  // ── Compose ──
  server.registerTool(
    "validate_video",
    {
      title: "Validate a project",
      description:
        "Check a project's IR and return the shot plan, without writing anything. Use it while drafting.",
      inputSchema: { name: project },
      annotations: readOnly,
    },
    ({ name }) => run(() => studio.validate(name)),
  );
  server.registerTool(
    "compile_video",
    {
      title: "Compile a project",
      description:
        "Compile a project's IR into a HyperFrames project in its build/ folder. The reply lists placeholders (stand-ins that must be replaced before publishing), warnings and credits owed.",
      inputSchema: { name: project },
    },
    ({ name }) => run(() => studio.compile(name)),
  );
  server.registerTool(
    "review_video",
    {
      title: "Review a project from real frames",
      description:
        "Compile, run HyperFrames' own check, and take two frames from every shot. Returns the check findings and the contact sheets as images. LOOK at the images and judge them against the rubric in REVIEW.md: a passing check is not a finished film. Takes around a minute.",
      inputSchema: { name: project },
    },
    ({ name }) => {
      let sheets: string[] = [];
      return run(
        () => {
          const review = studio.review(name);
          sheets = review.sheets;
          return {
            check: review.check,
            frames: review.frames,
            contactSheets: review.sheets,
            reviewFile: review.reviewFile,
            placeholders: review.compiled.placeholders,
            warnings: review.compiled.warnings,
            next: "Answer every row of REVIEW.md from the images. Revise the IR if any row fails.",
          };
        },
        () =>
          sheets.map((file) => ({
            type: "image" as const,
            data: readFileSync(file).toString("base64"),
            mimeType: "image/jpeg",
          })),
      );
    },
  );

  // ── Render ──
  server.registerTool(
    "render_video",
    {
      title: "Start a render",
      description:
        "Start rendering a compiled project to MP4 in the background and return a job id at once. Render only after review_video passes and the person agrees. Poll with get_job_status.",
      inputSchema: { name: project, quality: z.enum(["draft", "looks", "delivery"]).default("looks") },
    },
    ({ name, quality }) => run(() => studio.renders.start(name, quality)),
  );
  server.registerTool(
    "get_job_status",
    {
      title: "Check a job",
      description:
        "Where a render job stands: running, done, failed or cancelled, with the renderer's last output.",
      inputSchema: { id: z.string().describe("Job id from render_video") },
      annotations: readOnly,
    },
    ({ id }) => run(() => studio.renders.status(id)),
  );
  server.registerTool(
    "cancel_job",
    {
      title: "Cancel a job",
      description:
        "Stop a running render job, for example when the person changes their mind or a render hangs.",
      inputSchema: { id: z.string() },
    },
    ({ id }) => run(() => studio.renders.cancel(id)),
  );
  server.registerTool(
    "inspect_render",
    {
      title: "Inspect a finished render",
      description:
        "The rendered file's real length, codecs and whether its length matches the plan. Confirm this before reporting a film as done.",
      inputSchema: { name: project },
      annotations: readOnly,
    },
    ({ name }) => run(() => studio.renders.inspect(name)),
  );

  // ── Assets ──
  server.registerTool(
    "search_assets",
    {
      title: "Search free, openly licensed media",
      description:
        "Search free sources (Openverse, Poly Haven, Pixabay when keyed) for images, audio or video. Only assets whose own licence allows commercial use and editing are returned, each with its licence and any credit owed. Licence data comes from the source: tell the person where each asset came from. Never use this to stand in for the real product.",
      inputSchema: {
        query: z.string(),
        kind: z.enum(["image", "audio", "video"]),
        limit: z.number().int().min(1).max(25).default(8),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ query, kind, limit }) => run(() => studio.assets.search(query, kind, limit)),
  );
  server.registerTool(
    "download_asset",
    {
      title: "Download an asset into a project",
      description:
        "Download one asset returned by search_assets into a project's assets/ folder and record its licence in LICENSES.json. Assets the licence gate did not pass are refused.",
      inputSchema: {
        name: project,
        asset: z
          .record(z.string(), z.unknown())
          .describe("An asset object exactly as search_assets returned it"),
        fileName: z.string().optional(),
      },
      annotations: { openWorldHint: true },
    },
    ({ name, asset, fileName }) => run(() => studio.assets.download(name, asset as never, fileName)),
  );
  server.registerTool(
    "list_project_assets",
    {
      title: "List a project's assets",
      description:
        "The media files in a project's assets/ folder with their licences, and the credit lines the film owes.",
      inputSchema: { name: project },
      annotations: readOnly,
    },
    ({ name }) => run(() => studio.assets.list(name)),
  );

  // ── Audio ──
  server.registerTool(
    "list_audio_providers",
    {
      title: "List voiceover providers",
      description:
        "Where a voice can come from, what each costs, whether it is available now, and what its output may be used for.",
      inputSchema: {},
      annotations: readOnly,
    },
    () => run(() => studio.audio.providers()),
  );
  server.registerTool(
    "generate_voiceover",
    {
      title: "Generate a voiceover clip",
      description:
        "Make one narration clip in a project's assets/. provider `system` is a free draft voice (a placeholder: mark it origin placeholder in the IR). provider `elevenlabs` needs its key; on the Free plan it runs inside the remaining credits and the result is non-commercial; on a paid plan it is refused unless userConfirmedCost is true. Set userConfirmedCost ONLY after showing the person the estimate and getting their yes.",
      inputSchema: {
        name: project,
        text: z.string().min(1).max(600),
        file: z.string().describe("File name without extension, for example vo-hook"),
        provider: z.enum(["system", "elevenlabs"]).default("system"),
        voice: z.string().optional().describe("System voice name, or ElevenLabs voice id"),
        language: z.string().optional().describe("ISO 639-1 code, for example id"),
        userConfirmedCost: z.boolean().default(false),
      },
      annotations: { openWorldHint: true },
    },
    ({ name, text, file, provider, voice, language, userConfirmedCost }) =>
      run(() =>
        studio.audio.voiceover(name, {
          text,
          file,
          provider,
          voice,
          language,
          confirmCost: userConfirmedCost,
        }),
      ),
  );
  server.registerTool(
    "inspect_audio",
    {
      title: "Inspect an audio file",
      description:
        "A project file's real length and format. Use the length as a voice clip's `duration` in the IR.",
      inputSchema: {
        name: project,
        file: z.string().describe("Path inside the project, for example assets/vo-hook.m4a"),
      },
      annotations: readOnly,
    },
    ({ name, file }) => run(() => studio.audio.inspect(name, file)),
  );
}
