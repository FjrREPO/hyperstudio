import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { compile } from "./compile.ts";
import { CompileError } from "./errors.ts";
import { readLivePage } from "./live.ts";

const PAGE = `<!doctype html><html><head>
<!-- The compiler takes the <style> and the .app element. -->
<style>.app { --ink: #111; color: var(--ink); } .app[data-state="open"] .menu { display: block; }</style></head>
<body><div class="app" data-state="closed" data-states="closed open" style="--gap: 4px">
<button data-region="toggle">Menu</button><div class="menu" data-region="menu">Items</div></div>
<script>document.title = "x";</script></body></html>`;

const dir = mkdtempSync(join(tmpdir(), "hs-live-"));
writeFileSync(join(dir, "page.html"), PAGE);

const film = (beats: object[], duration = 3) => {
  const file = join(dir, `${Math.random().toString(36).slice(2)}.json`);
  const sentence = "A sentence long enough to count.";
  writeFileSync(
    file,
    JSON.stringify({
      project: { title: "Live" },
      direction: Object.fromEntries(
        ["concept", "audience", "message", "tone", "palette", "typography", "motion", "pacing"].map((k) => [
          k,
          sentence,
        ]),
      ),
      brand: { name: "Demo", kind: "example" },
      screens: { app: { html: "page.html", width: 800, height: 600, origin: "placeholder" } },
      scenes: [{ id: "take", recipe: "product-take", duration, purpose: sentence, screen: "app", beats }],
    }),
  );
  return file;
};
const problems = (beats: object[]) => {
  try {
    compile(film(beats), { validateOnly: true });
    return [];
  } catch (e) {
    assert.ok(e instanceof CompileError, String(e));
    return e.issues.map((i) => i.path);
  }
};

test("a live page gives its styles, markup, regions and states; scripts and comments are dropped", () => {
  const page = readLivePage(join(dir, "page.html"));
  assert.ok(typeof page !== "string", String(page));
  // A comment that names a tag is not that tag: the styles start at the real rule.
  assert.match(page.css, /^\.app \{/);
  // The page's custom properties are renamed, so a film's --ink cannot repaint the product.
  assert.match(page.css, /--ui-ink: #111; color: var\(--ui-ink\)/);
  assert.match(page.html, /style="--ui-gap: 4px"/);
  assert.doesNotMatch(page.html, /<script/);
  assert.deepEqual(page.regions, ["toggle", "menu"]);
  assert.deepEqual(page.states, ["closed", "open"]);
});

test("a page without an .app element is refused with the reason", () => {
  writeFileSync(join(dir, "bare.html"), "<html><body><p>hi</p></body></html>");
  assert.match(String(readLivePage(join(dir, "bare.html"))), /class "app"/);
});

test("beats are checked against the page they drive", () => {
  assert.deepEqual(
    problems([
      { at: 0.5, do: "click", target: "toggle", state: "open" },
      { at: 1.5, do: "camera", target: "menu" },
    ]),
    [],
  );
  assert.deepEqual(problems([{ at: 0.5, do: "click", target: "nowhere" }]), ["scenes.0.beats.0.target"]);
  assert.deepEqual(problems([{ at: 0.5, do: "state", state: "exploded" }]), ["scenes.0.beats.0.state"]);
  assert.deepEqual(problems([{ at: 0.5, do: "type", target: "toggle" }]), ["scenes.0.beats.0.text"]);
  assert.deepEqual(problems([{ at: 9, do: "cursor", target: "menu" }]), ["scenes.0.beats.0.at"]);
  assert.deepEqual(problems([]), ["scenes.0.beats"]);
  // The film's own lines: they need text, and long enough on screen to be read.
  assert.deepEqual(problems([{ at: 0, do: "say", place: "left", size: "hero" }]), ["scenes.0.beats.0.text"]);
  assert.deepEqual(problems([{ at: 0, do: "say", text: "Four words to read", over: 0.8 }]), [
    "scenes.0.beats.0.over",
  ]);
  assert.deepEqual(
    problems([
      { at: 0, do: "say", text: "Four words to read", over: 1.7 },
      { at: 1.8, do: "veil", target: "toggle" },
    ]),
    [],
  );
  assert.deepEqual(
    problems([
      { at: 0.2, do: "count", target: "menu" },
      { at: 1, do: "camera", target: "menu", tilt: "left", focus: "all", side: "right" },
    ]),
    [],
  );
});

test("a take in which nothing starts for too long is flagged as frozen", () => {
  const beats = [{ at: 0.2, do: "cursor", target: "toggle" }];
  const { warnings } = compile(film(beats, 6), { validateOnly: true });
  assert.match(warnings[0]?.message ?? "", /nothing starts for 5\.\ds/);
  // A beat covers the time it takes: typing for four seconds is not a freeze.
  const typing = [{ at: 0.2, do: "type", target: "toggle", text: "hello", over: 4.5 }];
  assert.deepEqual(compile(film(typing, 6), { validateOnly: true }).warnings, []);
});

test("the page travels inside the scene, on one line, with nothing that can end its script element", () => {
  const out = mkdtempSync(join(tmpdir(), "hs-live-out-"));
  const result = compile(film([{ at: 0.5, do: "click", target: "toggle", state: "open" }]), { output: out });
  const scene = result.files.find((f) => f.endsWith("compositions/take.html"));
  assert.ok(scene);
});
