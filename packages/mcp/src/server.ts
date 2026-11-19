#!/usr/bin/env node
import { timingSafeEqual } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./index.ts";

// Two ways in:
//   hyperstudio-mcp                      STDIO, for an agent running on this machine (the default)
//   hyperstudio-mcp --http 3900          Streamable HTTP, for an agent elsewhere. Needs HYPERSTUDIO_MCP_TOKEN.
// The workspace is HYPERSTUDIO_WORKSPACE or the directory it is started in. Tools cannot reach outside it.

const { values } = parseArgs({
  options: {
    http: { type: "string" },
    host: { type: "string", default: "127.0.0.1" },
    workspace: { type: "string" },
  },
});
const workspace = resolve(values.workspace ?? process.env.HYPERSTUDIO_WORKSPACE ?? process.cwd());

if (values.http === undefined) {
  await createServer({ workspace }).connect(new StdioServerTransport());
} else {
  const token = process.env.HYPERSTUDIO_MCP_TOKEN;
  if (!token || token.length < 16) {
    console.error(
      "HTTP mode needs HYPERSTUDIO_MCP_TOKEN (16 characters or more). Refusing to serve without one.",
    );
    process.exit(1);
  }
  const authorised = (header: string | undefined) => {
    const given = Buffer.from(header?.replace(/^Bearer /, "") ?? "");
    const wanted = Buffer.from(token);
    return given.length === wanted.length && timingSafeEqual(given, wanted);
  };
  const http = createHttpServer(async (req, res) => {
    if (req.url !== "/mcp") return void res.writeHead(404).end();
    if (!authorised(req.headers.authorization))
      return void res.writeHead(401, { "www-authenticate": "Bearer" }).end();
    // Stateless: one server and transport per request, so requests cannot see each other's state.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => void transport.close());
    await createServer({ workspace }).connect(transport);
    await transport.handleRequest(req, res);
  });
  http.listen(Number(values.http), values.host, () =>
    console.error(`HyperStudio MCP on http://${values.host}:${values.http}/mcp (workspace: ${workspace})`),
  );
}
