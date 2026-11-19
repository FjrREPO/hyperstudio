import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// The MCP server as an agent meets it: a real process, the official client, the real protocol over STDIO.
// Nothing is mocked. The workspace is a temporary folder holding a copy of the benchmark project.

const ROOT = join(import.meta.dirname, "../..");
const SERVER = join(ROOT, "packages/mcp/src/server.ts");
const workspace = mkdtempSync(join(tmpdir(), "hs-mcp-"));
const client = new Client({ name: "hyperstudio-test", version: "0.0.0" });
/** The text of a resource read. */
const read = async (uri: string) => {
  const [first] = (await client.readResource({ uri })).contents;
  return first && "text" in first ? String(first.text) : "";
};
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const result = (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: { type: string; text?: string }[];
  };
  const text = result.content.find((c) => c.type === "text")?.text ?? "";
  return { isError: result.isError === true, text, data: result.isError ? undefined : JSON.parse(text) };
};

before(async () => {
  cpSync(join(ROOT, "examples/saas-product-showcase"), join(workspace, "showcase"), {
    recursive: true,
    filter: (source) => !/\/(build|renders|product|\.tmp-[^/]*)(\/|$)/.test(source),
  });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [SERVER, "--workspace", workspace],
      stderr: "ignore",
    }),
  );
});
after(() => client.close());

test("the server introduces itself and lists its tools, resources and prompts", async () => {
  assert.equal(client.getServerVersion()?.name, "hyperstudio");
  assert.match(client.getInstructions() ?? "", /never invent a metric/i);
  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  for (const name of [
    "create_project",
    "save_ir",
    "validate_video",
    "compile_video",
    "review_video",
    "render_video",
    "get_job_status",
    "search_assets",
    "generate_voiceover",
  ])
    assert.ok(tools.includes(name), name);
  assert.ok((await client.listTools()).tools.every((t) => t.description && t.description.length > 30));
  const resources = (await client.listResources()).resources.map((r) => r.uri);
  assert.ok(resources.includes("hyperstudio://ir-schema"));
  assert.ok(resources.includes("hyperstudio://guide/direction"));
  assert.ok((await client.listPrompts()).prompts.some((p) => p.name === "product-showcase"));
});

test("resources carry the real schema and guides", async () => {
  const schema = JSON.parse(await read("hyperstudio://ir-schema"));
  assert.deepEqual(schema.required.sort(), ["brand", "direction", "project", "scenes"]);
  const guide = await read("hyperstudio://guide/direction");
  assert.match(guide, /Real product first/);
});

test("an agent can inspect, validate and compile a project", async () => {
  assert.deepEqual((await call("list_projects")).data.projects, ["showcase"]);
  const project = (await call("get_project", { name: "showcase" })).data;
  assert.equal(project.plan.duration, 17);
  assert.equal(project.screens.length, 4);
  const plan = (await call("validate_video", { name: "showcase" })).data;
  assert.equal(plan.scenes.length, 10);
  assert.ok(plan.placeholders.includes("screen: home"));
  const built = (await call("compile_video", { name: "showcase" })).data;
  assert.equal(built.ok, true);
  assert.match(
    readFileSync(join(workspace, "showcase/build/index.html"), "utf8"),
    /data-composition-id="main"/,
  );
});

test("a bad IR comes back as problems the agent can fix, and is still saved", async () => {
  const ir = JSON.parse(readFileSync(join(workspace, "showcase/video.json"), "utf8"));
  await call("create_project", { name: "draft" });
  ir.scenes[2].params.accent = "#ff0000";
  ir.scenes[5].params.to = "nowhere";
  // The draft has no files of its own, so the screens will be reported missing too: that is the point.
  const outcome = (await call("save_ir", { name: "draft", ir })).data;
  assert.equal(outcome.ok, false);
  const paths = outcome.errors.map((e: { path: string }) => e.path);
  assert.ok(paths.includes("scenes.2.params.accent"));
  assert.ok(paths.includes("scenes.5.params.to"));
  assert.ok(paths.includes("screens.home.src"));
  assert.equal((await call("get_project", { name: "draft" })).data.ir.scenes.length, 10);
});

test("tools cannot leave the workspace", async () => {
  for (const name of ["../escape", "/etc", "a/b", "UPPER"]) {
    const result = await call("get_project", { name });
    assert.equal(result.isError, true, name);
    assert.match(result.text, /not a project name/);
  }
  const file = await call("inspect_audio", { name: "showcase", file: "../../etc/passwd" });
  assert.equal(file.isError, true);
  assert.match(file.text, /outside the project/);
});

test("rendering before compiling, and unknown jobs, are plain errors", async () => {
  await call("create_project", { name: "empty" });
  assert.match((await call("render_video", { name: "empty" })).text, /not compiled yet/);
  assert.match((await call("get_job_status", { id: "render-nope" })).text, /no job with id/);
});

test("voiceover: ElevenLabs without a key is refused, and nothing is generated", async () => {
  const providers = (await call("list_audio_providers")).data;
  assert.equal(providers.find((p: { id: string }) => p.id === "elevenlabs").cost, "plan-credits");
  if (process.env.ELEVENLABS_API_KEY) return;
  const result = await call("generate_voiceover", {
    name: "showcase",
    text: "Hello.",
    file: "vo",
    provider: "elevenlabs",
    voice: "v1",
  });
  assert.equal(result.isError, true);
  assert.match(result.text, /ELEVENLABS_API_KEY is not set/);
});

test("HTTP mode refuses to start without a token, and serves the same tools with one", async () => {
  const { spawn, spawnSync } = await import("node:child_process");
  const { StreamableHTTPClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/streamableHttp.js"
  );
  const port = 39000 + Math.floor(Math.random() * 900);
  const args = [SERVER, "--http", String(port), "--workspace", workspace];

  const refused = spawnSync(process.execPath, args, {
    encoding: "utf8",
    env: { ...process.env, HYPERSTUDIO_MCP_TOKEN: "" },
  });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Refusing to serve without one/);

  const token = "mcp-token-0123456789abcdef";
  const child = spawn(process.execPath, args, {
    env: { ...process.env, HYPERSTUDIO_MCP_TOKEN: token },
    stdio: ["ignore", "ignore", "pipe"],
  });
  try {
    await new Promise<void>((ready) =>
      child.stderr.on("data", (line) => String(line).includes("/mcp") && ready()),
    );
    const url = new URL(`http://127.0.0.1:${port}/mcp`);
    assert.equal((await fetch(url, { method: "POST", body: "{}" })).status, 401);

    const remote = new Client({ name: "hyperstudio-http-test", version: "0.0.0" });
    await remote.connect(
      new StreamableHTTPClientTransport(url, {
        requestInit: { headers: { authorization: `Bearer ${token}` } },
      }),
    );
    const result = (await remote.callTool({ name: "list_projects", arguments: {} })) as {
      content: { text: string }[];
    };
    assert.ok(JSON.parse(result.content[0]?.text ?? "{}").projects.includes("showcase"));
    await remote.close();
  } finally {
    child.kill();
  }
});
