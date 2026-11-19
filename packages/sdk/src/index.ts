import { createStudio, type JobStatus, type Outcome, type Studio } from "@hyperstudio/studio";

/**
 * @hyperstudio/sdk — one client, two backends.
 *
 *   const studio = new HyperStudio({ workspace: "./films" });      // the engine, in this process
 *   const studio = new HyperStudio({ baseUrl, apiKey });           // a HyperStudio API somewhere else
 *
 * Both give the same methods and the same results.
 */

export interface RemoteOptions {
  /** Where the API is, for example http://127.0.0.1:3901 */
  baseUrl: string;
  apiKey: string;
  fetch?: typeof globalThis.fetch;
}

export interface LocalOptions {
  /** A folder with one sub-folder per project. */
  workspace: string;
}

/** An error answered by the API, with its status and code. */
export class HyperStudioError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HyperStudioError";
    this.status = status;
    this.code = code;
  }
}

type Recipe = ReturnType<Studio["recipes"]["get"]>;
type Project = ReturnType<Studio["projects"]["get"]>;
type Created = ReturnType<Studio["projects"]["create"]>;
type Found = Awaited<ReturnType<Studio["assets"]["search"]>>;
type Review = Omit<ReturnType<Studio["review"]>, "compiled">;
type Render = ReturnType<Studio["renders"]["inspect"]>;
type ProjectAssets = ReturnType<Studio["assets"]["list"]>;
/** A name as one path segment, so it cannot change the route. */
const seg = encodeURIComponent;

export class HyperStudio {
  readonly #local: Studio | undefined;
  readonly #remote: RemoteOptions | undefined;

  constructor(options: RemoteOptions | LocalOptions) {
    if ("workspace" in options) this.#local = createStudio({ root: options.workspace });
    else this.#remote = options;
  }

  /** The engine in this process: no server, no key. */
  static local(options: LocalOptions): HyperStudio {
    return new HyperStudio(options);
  }

  /** Run a call on the local engine, or send it to the API. */
  async #do<T>(
    local: (studio: Studio) => T | Promise<T>,
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    if (this.#local) return await local(this.#local);
    const remote = this.#remote as RemoteOptions;
    const response = await (remote.fetch ?? globalThis.fetch)(
      `${remote.baseUrl.replace(/\/$/, "")}/api/v1${path}`,
      {
        method,
        headers: {
          authorization: `Bearer ${remote.apiKey}`,
          ...(body ? { "content-type": "application/json" } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new HyperStudioError(
        response.status,
        data?.error?.code ?? "error",
        data?.error?.message ?? response.statusText,
      );
    return data as T;
  }

  get projects() {
    return {
      list: async (): Promise<string[]> =>
        (await this.#do((s) => ({ projects: s.projects.list() }), "GET", "/projects")).projects,
      /** Make a project; with an IR, save and validate it in the same step. */
      create: (name: string, ir?: unknown): Promise<Created> =>
        this.#do((s) => s.projects.create(name, ir), "POST", "/projects", { name, ir }),
      get: (name: string): Promise<Project> =>
        this.#do((s) => s.projects.get(name), "GET", `/projects/${seg(name)}`),
      /** Replace the IR. A rejected IR is returned as `{ ok: false, errors }`, not thrown. */
      saveIr: (name: string, ir: unknown): Promise<Outcome> =>
        this.#do((s) => s.projects.saveIr(name, ir), "PUT", `/projects/${seg(name)}/ir`, { ir }),
    };
  }

  get recipes() {
    return {
      list: async (): Promise<Recipe[]> =>
        (await this.#do((s) => ({ recipes: s.recipes.list() }), "GET", "/recipes")).recipes,
      get: (name: string): Promise<Recipe> =>
        this.#do((s) => s.recipes.get(name), "GET", `/recipes/${seg(name)}`),
    };
  }

  /** Validate and plan a project, writing nothing. */
  validate(name: string): Promise<Outcome> {
    return this.#do((s) => s.validate(name), "POST", `/projects/${seg(name)}/validate`);
  }

  /** Compile a project into a HyperFrames project. */
  compile(name: string): Promise<Outcome> {
    return this.#do((s) => s.compile(name), "POST", `/projects/${seg(name)}/compile`);
  }

  /** Compile, run hyperframes check, snapshot every shot. Returns findings and the contact sheets' paths. */
  review(name: string): Promise<Review> {
    return this.#do(
      (s) => {
        const { compiled: _compiled, ...review } = s.review(name);
        return review;
      },
      "POST",
      `/projects/${seg(name)}/review`,
    );
  }

  get renders() {
    const status = (id: string): Promise<JobStatus> =>
      this.#do((s) => s.renders.status(id), "GET", `/jobs/${seg(id)}`);
    return {
      /** Start a render. With `idempotencyKey`, a repeated call to the API returns the same job. */
      start: (
        name: string,
        options: { quality?: "draft" | "looks" | "delivery"; idempotencyKey?: string } = {},
      ): Promise<JobStatus | Omit<JobStatus, "state" | "bytes" | "tail">> =>
        this.#do(
          (s) => s.renders.start(name, options.quality),
          "POST",
          `/projects/${seg(name)}/renders`,
          { quality: options.quality ?? "looks" },
          options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : undefined,
        ),
      status,
      cancel: (id: string): Promise<JobStatus> =>
        this.#do((s) => s.renders.cancel(id), "DELETE", `/jobs/${seg(id)}`),
      /** Wait until a job is no longer running. */
      wait: async (
        id: string,
        options: { everyMs?: number; timeoutMs?: number } = {},
      ): Promise<JobStatus> => {
        const timeout = options.timeoutMs ?? 10 * 60_000;
        const until = Date.now() + timeout;
        for (;;) {
          const job = await status(id);
          if (job.state !== "running") return job;
          if (Date.now() > until) throw new Error(`job ${id} is still running after ${timeout} ms`);
          await new Promise((done) => setTimeout(done, options.everyMs ?? 2000));
        }
      },
      /** The finished file, checked against the plan. */
      inspect: (name: string): Promise<Render> =>
        this.#do((s) => s.renders.inspect(name), "GET", `/projects/${seg(name)}/render`),
    };
  }

  get assets() {
    return {
      /** Search free, openly licensed media. Only assets a commercial film may use are returned. */
      search: (query: string, kind: "image" | "audio" | "video", limit?: number): Promise<Found> =>
        this.#do((s) => s.assets.search(query, kind, limit), "POST", "/assets/search", {
          query,
          kind,
          limit,
        }),
      list: (name: string): Promise<ProjectAssets> =>
        this.#do((s) => s.assets.list(name), "GET", `/projects/${seg(name)}/assets`),
    };
  }
}
