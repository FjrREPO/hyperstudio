import assert from "node:assert/strict";
import { cpSync, mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createApi } from "../../packages/api/src/index.ts";
import { HyperStudio, HyperStudioError } from "../../packages/sdk/src/index.ts";

// The REST API on a real port, driven by the SDK over real HTTP, and the SDK's local mode beside it.
// Both must give the same answers, because both are the same engine.

const ROOT = join(import.meta.dirname, "../..");
const KEY = "test-key-0123456789abcdef";
const workspace = mkdtempSync(join(tmpdir(), "hs-api-"));
cpSync(join(ROOT, "tests/fixtures/films/saas-product-showcase"), join(workspace, "showcase"), {
  recursive: true,
  filter: (source) => !/\/(build|renders|product|\.tmp-[^/]*)(\/|$)/.test(source),
});
const server = createApi({ workspace, apiKey: KEY, ratePerMinute: 40 });
let baseUrl = "";
let remote: HyperStudio;
const local = HyperStudio.local({ workspace });

before(async () => {
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  remote = new HyperStudio({ baseUrl, apiKey: KEY });
});
after(() => server.close());

test("a request without the key is refused", async () => {
  assert.equal((await fetch(`${baseUrl}/api/v1/projects`)).status, 401);
  assert.equal(
    (
      await fetch(`${baseUrl}/api/v1/projects`, {
        headers: { authorization: "Bearer wrong-key-000000000000" },
      })
    ).status,
    401,
  );
  await assert.rejects(
    () => new HyperStudio({ baseUrl, apiKey: "nope" }).projects.list(),
    (e: unknown) => e instanceof HyperStudioError && e.status === 401 && e.code === "unauthorized",
  );
});

test("remote and local give the same plan for the same project", async () => {
  assert.deepEqual(await remote.projects.list(), await local.projects.list());
  const [a, b] = [await remote.validate("showcase"), await local.validate("showcase")];
  assert.ok(a.ok && b.ok);
  assert.deepEqual(a, b);
  assert.equal(a.scenes.length, 10);
});

test("a film can be made through the SDK: create, save, validate, compile", async () => {
  const source = await remote.projects.get("showcase");
  const ir = structuredClone(source.ir) as {
    screens: Record<string, { src: string }>;
    scenes: { assets?: Record<string, { src: string }> }[];
    audio: { src: string }[];
  };
  // The new project points at the first project's files, so it needs none of its own.
  for (const screen of Object.values(ir.screens)) screen.src = `../showcase/${screen.src}`;
  for (const scene of ir.scenes)
    for (const asset of Object.values(scene.assets ?? {})) asset.src = `../showcase/${asset.src}`;
  for (const clip of ir.audio) clip.src = `../showcase/${clip.src}`;

  const created = await remote.projects.create("second");
  assert.equal(created.name, "second");
  const saved = await remote.projects.saveIr("second", ir);
  assert.equal(saved.ok, true);
  const built = await remote.compile("second");
  assert.ok(built.ok && built.files.includes("compositions/hook.html"));
  assert.equal((await remote.projects.get("second")).compiled, true);
  await assert.rejects(
    () => remote.projects.create("second"),
    (e: unknown) => e instanceof HyperStudioError && e.status === 409,
  );
});

test("a rejected IR is a result, not an exception", async () => {
  const outcome = await remote.projects.saveIr("second", { project: { title: "x" } });
  assert.equal(outcome.ok, false);
  assert.ok(!outcome.ok && outcome.errors.some((e) => e.path === "direction"));
});

test("errors carry a status and a code", async () => {
  await assert.rejects(
    () => remote.projects.get("../escape"),
    (e: unknown) => e instanceof HyperStudioError && e.status === 400 && e.code === "invalid_name",
  );
  await assert.rejects(
    () => remote.projects.get("missing"),
    (e: unknown) => e instanceof HyperStudioError && e.status === 404,
  );
  await assert.rejects(
    () => remote.renders.status("render-nope"),
    (e: unknown) => e instanceof HyperStudioError && e.status === 404,
  );
  await assert.rejects(
    () => remote.recipes.get("nope"),
    (e: unknown) => e instanceof HyperStudioError && e.status === 404,
  );
  const bad = await fetch(`${baseUrl}/api/v1/projects`, {
    method: "POST",
    headers: { authorization: `Bearer ${KEY}` },
    body: "not json",
  });
  assert.equal(bad.status, 400);
});

test("recipes, schema and the OpenAPI document are served", async () => {
  assert.deepEqual(
    (await remote.recipes.list()).map((r) => r.name),
    ["brand-close", "luxury-product-reveal", "product-shot", "product-take", "scatter", "statement"],
  );
  assert.equal((await remote.recipes.get("product-shot")).showsScreen, true);
  const spec = await (
    await fetch(`${baseUrl}/api/v1/openapi.json`, { headers: { authorization: `Bearer ${KEY}` } })
  ).json();
  assert.equal(spec.openapi, "3.1.0");
  assert.ok(spec.paths["/api/v1/projects/{name}/renders"].post);
  assert.ok(spec.paths["/api/v1/jobs/{id}"].delete);
});

test("too many requests are refused", async () => {
  const statuses: number[] = [];
  for (let i = 0; i < 45; i++)
    statuses.push(
      (await fetch(`${baseUrl}/api/v1/recipes`, { headers: { authorization: `Bearer ${KEY}` } })).status,
    );
  assert.ok(statuses.includes(429));
  assert.equal(statuses[0], 200);
});
