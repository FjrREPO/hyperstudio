import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Studio } from "@hyperstudio/studio";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Knowledge an agent should read rather than guess: served as resources, with prompts for common jobs.
// The text comes from the repository's own documents, so there is one source of truth.

const REPO = join(import.meta.dirname, "../../..");
const GUIDES = {
  direction: [
    "skills/hyperstudio-director/SKILL.md",
    "How to direct a film: product, direction, shots, IR, review, render",
  ],
  ir: ["docs/IR-SPECIFICATION.md", "Every field of the Creative IR and what the compiler enforces"],
  recipes: ["docs/RECIPE-DEVELOPMENT.md", "What a shot recipe is and how the recipes behave"],
  "asset-licensing": ["docs/ASSET-LICENSING.md", "What each free media source allows, and the licence gate"],
  audio: ["docs/AUDIO-ENGINE.md", "Voiceover and dubbing: providers, audio in the IR"],
  "audio-costs": ["docs/AUDIO-COST-CONTROLS.md", "What stops audio generation from spending without consent"],
} as const;

export const INSTRUCTIONS = `HyperStudio makes product and brand films on HyperFrames. You direct; it compiles and checks.
Before writing a Creative IR, read hyperstudio://guide/direction and hyperstudio://ir-schema.
Work in this order: get the real product (screenshots with named regions) -> write the direction -> list the shots in words -> save_ir -> validate_video -> review_video (look at the returned frames) -> revise -> render_video -> inspect_render.
Rules: never invent a metric, feature or customer; never draw a stand-in for the product; a passing check is not a finished film; never set userConfirmedCost without the person's explicit yes; tell the person about every placeholder and every credit owed.`;

export function registerContext(server: McpServer, studio: Studio): void {
  server.registerResource(
    "ir-schema",
    "hyperstudio://ir-schema",
    {
      title: "Creative IR schema",
      description: "JSON Schema of the Creative IR document",
      mimeType: "application/json",
    },
    (uri) => ({
      contents: [
        { uri: uri.href, mimeType: "application/json", text: JSON.stringify(studio.schema(), null, 2) },
      ],
    }),
  );
  server.registerResource(
    "recipes",
    "hyperstudio://recipes",
    { title: "Shot recipes", description: "Every recipe with its variables", mimeType: "application/json" },
    (uri) => ({
      contents: [
        { uri: uri.href, mimeType: "application/json", text: JSON.stringify(studio.recipes.list(), null, 2) },
      ],
    }),
  );
  for (const [name, [path, description]] of Object.entries(GUIDES)) {
    const file = join(REPO, path);
    if (!existsSync(file)) continue;
    server.registerResource(
      `guide-${name}`,
      `hyperstudio://guide/${name}`,
      { title: `Guide: ${name}`, description, mimeType: "text/markdown" },
      (uri) => ({
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: readFileSync(file, "utf8") }],
      }),
    );
  }

  const prompt = (text: string) => ({
    messages: [{ role: "user" as const, content: { type: "text" as const, text } }],
  });
  server.registerPrompt(
    "product-showcase",
    {
      title: "Create a product showcase film",
      description: "A short film that shows a real product working",
      argsSchema: {
        product: z.string().describe("The product and where its screens can be found"),
        seconds: z.string().optional(),
      },
    },
    ({ product, seconds }) =>
      prompt(
        `Make a ${seconds ?? "15"}-second product showcase for: ${product}\n\nRead hyperstudio://guide/direction first and follow its order. Start from the real product: get its screens and name their regions. If you cannot get them, ask me for them before doing anything else. Write the direction, list the shots in words and show me, then build with save_ir, validate_video and review_video. Look at the frames review_video returns and tell me what you see before rendering.`,
      ),
  );
  server.registerPrompt(
    "saas-launch-video",
    {
      title: "Create a SaaS launch video",
      description: "Hook, product reveal, one feature shown working, the benefit, a brand close",
      argsSchema: { product: z.string(), audience: z.string().optional() },
    },
    ({ product, audience }) =>
      prompt(
        `Make a launch film for ${product}${audience ? `, for ${audience}` : ""}.\n\nRead hyperstudio://guide/direction. Use the real interface in product-shot shots, cut every one to two seconds, and keep copy to one short line at a time. Take the brand's colours and typefaces from the product itself. No invented statistics. Show me the direction and the shot list before you build.`,
      ),
  );
  server.registerPrompt(
    "review-video-quality",
    {
      title: "Review a film's quality",
      description: "Judge a project from its frames against the rubric",
      argsSchema: { project: z.string() },
    },
    ({ project }) =>
      prompt(
        `Review the project "${project}". Call review_video and look at every contact sheet it returns. Answer each of the ten rubric rows in its REVIEW.md with a verdict and what you saw in the frames. Be specific about anything clipped, crowded, repeated or off-balance, and say plainly if it reads as a template. List every placeholder.`,
      ),
  );
  server.registerPrompt(
    "localize-video",
    {
      title: "Localise a finished film",
      description: "Narration in another language, or a dub of the rendered file",
      argsSchema: { project: z.string(), language: z.string() },
    },
    ({ project, language }) =>
      prompt(
        `Localise the project "${project}" into ${language}. Read hyperstudio://guide/audio and hyperstudio://guide/audio-costs. Prefer new narration clips tied to scenes over a dub. Call list_audio_providers, tell me what each option costs and what its output may be used for, and wait for my choice before generating anything.`,
      ),
  );
}
