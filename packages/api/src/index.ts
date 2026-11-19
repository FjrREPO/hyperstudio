import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createStudio, WorkspaceError } from "@hyperstudio/studio";
import pkg from "../package.json" with { type: "json" };
import { BadRequest, openapi, ROUTES, type Route } from "./routes.ts";

/**
 * @hyperstudio/api — a versioned REST API over @hyperstudio/studio.
 * A thin adapter: routing, authentication, limits and JSON. No film-making logic.
 */
export { openapi, ROUTES, type Route } from "./routes.ts";

export interface ApiOptions {
  workspace: string;
  /** Every request must carry this as a bearer token. */
  apiKey: string;
  /** Requests allowed per minute. Default 120. */
  ratePerMinute?: number;
  env?: NodeJS.ProcessEnv;
}

const MAX_BODY = 1024 * 1024;

export function createApi(options: ApiOptions): Server {
  if (options.apiKey.length < 16) throw new Error("the API key must be at least 16 characters");
  const studio = createStudio({ root: options.workspace, env: options.env });
  const limit = options.ratePerMinute ?? 120;
  let windowStart = Date.now();
  let count = 0;
  const wanted = Buffer.from(options.apiKey);
  const authorised = (header: string | undefined) => {
    const given = Buffer.from(header?.replace(/^Bearer /, "") ?? "");
    return given.length === wanted.length && timingSafeEqual(given, wanted);
  };
  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const fail = (res: ServerResponse, status: number, code: string, message: string) =>
    send(res, status, { error: { code, message } });

  /** Why a request may not proceed, as [status, code, message], or undefined when it may. */
  const refusal = (req: IncomingMessage): [number, string, string] | undefined => {
    if (!authorised(req.headers.authorization))
      return [401, "unauthorized", "send the API key as a bearer token"];
    if (Date.now() - windowStart > 60_000) {
      windowStart = Date.now();
      count = 0;
    }
    count += 1;
    return count > limit ? [429, "rate_limited", `more than ${limit} requests in a minute`] : undefined;
  };

  return createServer(async (req, res) => {
    try {
      const refused = refusal(req);
      if (refused) return fail(res, ...refused);
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname === "/api/v1/openapi.json") return send(res, 200, openapi(pkg.version));
      const match = find(req.method ?? "GET", url.pathname);
      if (!match) return fail(res, 404, "not_found", `no route for ${req.method} ${url.pathname}`);
      const key = req.headers["idempotency-key"];
      const body = await readBody(req);
      const result = await match.route.handle(
        studio,
        match.params,
        body,
        typeof key === "string" ? key : undefined,
      );
      send(res, match.route.status ?? 200, result);
    } catch (error) {
      fail(res, ...explain(error));
    }
  });
}

/** An error as [status, code, message]. Only a known kind of error is blamed on the caller. */
function explain(error: unknown): [number, string, string] {
  const message = (error as Error).message;
  if (error instanceof BadRequest) return [400, "bad_request", message];
  if (error instanceof WorkspaceError) {
    const status = { "not-found": 404, exists: 409, "invalid-name": 400, "outside-workspace": 400 }[
      error.code
    ];
    return [status, error.code.replace("-", "_"), message];
  }
  const missing = /^no (job|recipe|project)|has not been rendered|not compiled/.test(message);
  return [missing ? 404 : 500, missing ? "not_found" : "error", message];
}

function find(
  method: string,
  pathname: string,
): { route: Route; params: Record<string, string> } | undefined {
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const pattern = new RegExp(`^/api/v1${route.path.replace(/:(\w+)/g, "(?<$1>[^/]+)")}/?$`);
    const hit = pattern.exec(pathname);
    if (hit)
      return {
        route,
        params: Object.fromEntries(
          Object.entries(hit.groups ?? {}).map(([k, v]) => [k, decodeURIComponent(v)]),
        ),
      };
  }
  return undefined;
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (req.method === "GET" || req.method === "DELETE") return {};
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new BadRequest("the request body is larger than 1 MB");
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new BadRequest("the request body must be a JSON object");
  }
}
