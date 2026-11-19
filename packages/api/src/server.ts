#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { createApi } from "./index.ts";

// hyperstudio-api --port 3901 [--host 127.0.0.1] [--workspace dir]
// Needs HYPERSTUDIO_API_KEY (16 characters or more). It will not start without one.

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "3901" },
    host: { type: "string", default: "127.0.0.1" },
    workspace: { type: "string" },
  },
});
const apiKey = process.env.HYPERSTUDIO_API_KEY ?? "";
if (apiKey.length < 16) {
  console.error("Set HYPERSTUDIO_API_KEY (16 characters or more). Refusing to serve without one.");
  process.exit(1);
}
const workspace = resolve(values.workspace ?? process.env.HYPERSTUDIO_WORKSPACE ?? process.cwd());
createApi({ workspace, apiKey }).listen(Number(values.port), values.host, () =>
  console.error(`HyperStudio API on http://${values.host}:${values.port}/api/v1 (workspace: ${workspace})`),
);
