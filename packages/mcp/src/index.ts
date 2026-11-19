import { createStudio } from "@hyperstudio/studio";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pkg from "../package.json" with { type: "json" };
import { INSTRUCTIONS, registerContext } from "./context.ts";
import { registerTools } from "./tools.ts";

/**
 * @hyperstudio/mcp — HyperStudio as a Model Context Protocol server.
 * Tools, resources and prompts over @hyperstudio/studio; nothing here makes a film by itself.
 */
export function createServer(options: { workspace: string; env?: NodeJS.ProcessEnv }): McpServer {
  const server = new McpServer({ name: "hyperstudio", version: pkg.version }, { instructions: INSTRUCTIONS });
  const studio = createStudio({ root: options.workspace, env: options.env });
  registerTools(server, studio);
  registerContext(server, studio);
  return server;
}

export { INSTRUCTIONS };
