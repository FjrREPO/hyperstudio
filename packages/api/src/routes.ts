import type { Studio } from "@hyperstudio/studio";

// The API's surface as data: each route names its path, what it does, and the one studio call behind it.
// The server, the OpenAPI document and the SDK are all derived from this list, so they cannot drift.

export interface Route {
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** Path under /api/v1, with :params. */
  path: string;
  summary: string;
  /** Success status. 202 means a background job was started. */
  status?: number;
  /** JSON body fields, for the OpenAPI document. */
  body?: Record<string, string>;
  handle(
    studio: Studio,
    params: Record<string, string>,
    body: Record<string, unknown>,
    idempotencyKey?: string,
  ): unknown;
}

const text = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.length === 0) throw new BadRequest(`"${name}" is required`);
  return value;
};

export class BadRequest extends Error {}

/** Renders started with an Idempotency-Key: the same key returns the same job instead of starting another. */
const started = new Map<string, string>();

export const ROUTES: Route[] = [
  {
    method: "GET",
    path: "/projects",
    summary: "List projects",
    handle: (s) => ({ projects: s.projects.list() }),
  },
  {
    method: "POST",
    path: "/projects",
    summary: "Create a project, optionally with its Creative IR",
    status: 201,
    body: { name: "string", ir: "object (optional)" },
    handle: (s, _p, b) => s.projects.create(text(b.name, "name"), b.ir),
  },
  {
    method: "GET",
    path: "/projects/:name",
    summary: "A project's IR, plan, files and renders",
    handle: (s, p) => s.projects.get(p.name ?? ""),
  },
  {
    method: "PUT",
    path: "/projects/:name/ir",
    summary: "Replace a project's Creative IR and validate it",
    body: { ir: "object" },
    handle: (s, p, b) => s.projects.saveIr(p.name ?? "", b.ir ?? b),
  },
  {
    method: "POST",
    path: "/projects/:name/validate",
    summary: "Validate and plan, writing nothing",
    handle: (s, p) => s.validate(p.name ?? ""),
  },
  {
    method: "POST",
    path: "/projects/:name/compile",
    summary: "Compile to a HyperFrames project",
    handle: (s, p) => s.compile(p.name ?? ""),
  },
  {
    method: "POST",
    path: "/projects/:name/review",
    summary: "Compile, run hyperframes check and snapshot every shot",
    handle: (s, p) => {
      const { compiled, ...review } = s.review(p.name ?? "");
      return { ...review, placeholders: compiled.placeholders, warnings: compiled.warnings };
    },
  },
  {
    method: "POST",
    path: "/projects/:name/renders",
    summary: "Start a render in the background",
    status: 202,
    body: { quality: "draft | looks | delivery (optional)" },
    handle: (s, p, b, key) => {
      const known = key ? started.get(key) : undefined;
      if (known) return s.renders.status(known);
      const job = s.renders.start(p.name ?? "", (b.quality as "looks" | undefined) ?? "looks");
      if (key) started.set(key, job.id);
      return job;
    },
  },
  {
    method: "GET",
    path: "/projects/:name/render",
    summary: "The finished render, checked against its plan",
    handle: (s, p) => s.renders.inspect(p.name ?? ""),
  },
  { method: "GET", path: "/jobs", summary: "List jobs", handle: (s) => ({ jobs: s.renders.list() }) },
  {
    method: "GET",
    path: "/jobs/:id",
    summary: "A job's status",
    handle: (s, p) => s.renders.status(p.id ?? ""),
  },
  {
    method: "DELETE",
    path: "/jobs/:id",
    summary: "Cancel a job",
    handle: (s, p) => s.renders.cancel(p.id ?? ""),
  },
  {
    method: "GET",
    path: "/recipes",
    summary: "List shot recipes",
    handle: (s) => ({ recipes: s.recipes.list() }),
  },
  {
    method: "GET",
    path: "/recipes/:name",
    summary: "One recipe with its variables",
    handle: (s, p) => s.recipes.get(p.name ?? ""),
  },
  { method: "GET", path: "/schema", summary: "JSON Schema of the Creative IR", handle: (s) => s.schema() },
  {
    method: "POST",
    path: "/assets/search",
    summary: "Search free, openly licensed media, gated by licence",
    body: { query: "string", kind: "image | audio | video", limit: "number (optional)" },
    handle: (s, _p, b) =>
      s.assets.search(
        text(b.query, "query"),
        text(b.kind, "kind") as "image",
        typeof b.limit === "number" ? b.limit : undefined,
      ),
  },
  {
    method: "GET",
    path: "/projects/:name/assets",
    summary: "A project's assets, licences and credits owed",
    handle: (s, p) => s.assets.list(p.name ?? ""),
  },
  {
    method: "GET",
    path: "/audio/providers",
    summary: "Voiceover providers, their cost and their terms",
    handle: (s) => ({ providers: s.audio.providers() }),
  },
];

/** An OpenAPI 3.1 description of the routes above. */
export function openapi(version: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of ROUTES) {
    const path = `/api/v1${route.path.replace(/:(\w+)/g, "{$1}")}`;
    const params = [...route.path.matchAll(/:(\w+)/g)].map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    }));
    const entry = paths[path] ?? {};
    entry[route.method.toLowerCase()] = {
      summary: route.summary,
      ...(params.length > 0 ? { parameters: params } : {}),
      ...(route.body
        ? {
            requestBody: {
              content: {
                "application/json": { schema: { type: "object", description: JSON.stringify(route.body) } },
              },
            },
          }
        : {}),
      responses: {
        [String(route.status ?? 200)]: { description: "Success", content: { "application/json": {} } },
        "400": { description: "The request was malformed" },
        "401": { description: "Missing or wrong API key" },
        "404": { description: "No such project, job or recipe" },
        "429": { description: "Too many requests" },
      },
    };
    paths[path] = entry;
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "HyperStudio API",
      version,
      description:
        "Projects, compile, review, renders, assets. Every call is the same engine the CLI and the MCP server use.",
    },
    security: [{ bearer: [] }],
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
    paths,
  };
}
