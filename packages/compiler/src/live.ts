import { readFileSync } from "node:fs";
import type { IR } from "@hyperstudio/ir";
import type { RecipeMeta } from "./recipes.ts";

// A live screen is the product's own page, mounted in a shot and driven by beats, instead of a screenshot.
// The page is one self-contained HTML file: its <style> blocks, and one element with class "app" whose
// data-state attribute decides what is shown. Scripts are dropped; a film drives the page itself.

export interface LivePage {
  css: string;
  html: string;
  /** Names of the page's data-region elements. */
  regions: string[];
  /** States the page's styles respond to, with the one it starts in first. */
  states: string[];
}

const all = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].map((m) => m[1] ?? "");
const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

/** Read a live page, or say why it cannot be used. */
export function readLivePage(file: string): LivePage | string {
  // Comments go first: one that mentions a tag by name must not be read as that tag.
  const source = readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  // The film hands its own variables (--ink, --accent, ...) to every scene. The page's custom properties are
  // renamed so a film's ink can never repaint the product's text.
  const own = (text: string) => text.replace(/--(?=[a-z])/g, "--ui-");
  const css = own(all(source, /<style[^>]*>([\s\S]*?)<\/style>/g).join("\n"));
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(source)?.[1];
  if (body === undefined) return "has no <body>";
  const html = own(body.replace(/<script[\s\S]*?<\/script>/g, "").trim());
  const app = /<[a-z]+[^>]*\bclass="(?:[^"]* )?app(?: [^"]*)?"[^>]*>/.exec(html)?.[0];
  if (!app)
    return 'has no element with class "app"; wrap the interface in one and style it from its data-state';
  const initial = /data-state="([^"]*)"/.exec(app)?.[1] ?? "";
  return {
    css,
    html,
    regions: unique(all(html, /data-region="([a-z][a-z0-9-]*)"/g)),
    // The page lists its states in data-states; without that, the ones its styles mention are used.
    states: unique([
      initial,
      ...(/data-states="([^"]*)"/.exec(app)?.[1]?.split(/\s+/) ??
        all(css, /\[data-state="([a-z][a-z0-9-]*)"\]/g)),
    ]),
  };
}

/** The longest stretch of a take in which no beat starts, before it reads as a frozen screen. */
const LONGEST_QUIET = 1.5;
const NEEDS_TARGET = new Set([
  "camera",
  "cursor",
  "click",
  "type",
  "reveal",
  "draw",
  "count",
  "scroll",
  "highlight",
  "veil",
]);

type Report = (path: string, message: string) => void;

/** Check a scene's beats against its recipe and the page it drives. */
export function checkBeats(
  scene: IR["scenes"][number],
  meta: RecipeMeta,
  page: LivePage | undefined,
  at: string,
  fail: Report,
  warn: Report,
): void {
  const takes = meta.hyperstudio.beats;
  if (!takes) {
    if (scene.beats.length > 0) fail(`${at}.beats`, `${meta.name} does not take beats; use product-take`);
    return;
  }
  if (!page) {
    fail(
      `${at}.screen`,
      `${meta.name} drives a live interface; its screen must be given as "html", not "src"`,
    );
    return;
  }
  if (scene.beats.length === 0)
    fail(`${at}.beats`, "a take with no beats is a still picture; say what happens in it");
  const regions = `Regions: ${page.regions.join(", ") || "(none)"}`;
  scene.beats.forEach((beat, i) => {
    const path = `${at}.beats.${i}`;
    if (beat.at >= scene.duration) fail(`${path}.at`, `is after the take ends (${scene.duration}s)`);
    if (NEEDS_TARGET.has(beat.do) && beat.target === undefined)
      fail(`${path}.target`, `"${beat.do}" needs a target region`);
    if (beat.target !== undefined && beat.target !== "window" && !page.regions.includes(beat.target))
      fail(`${path}.target`, `"${beat.target}" is not a region of this page. ${regions}`);
    if ((beat.do === "type" || beat.do === "say") && !beat.text)
      fail(`${path}.text`, `"${beat.do}" needs its text`);
    // A line has to be read: roughly half a second, and a third of a second a word.
    const words = beat.do === "say" ? (beat.text ?? "").trim().split(/\s+/).length : 0;
    if (words > 0 && beat.over !== undefined && beat.over < 0.5 + words * 0.3 - 1e-6)
      fail(
        `${path}.over`,
        `${beat.over}s is too short to read ${words} words; give it ${(0.5 + words * 0.3).toFixed(1)}s`,
      );
    if (beat.do === "state" && beat.state === undefined)
      fail(`${path}.state`, '"state" needs the state to switch to');
    if (beat.state !== undefined && !page.states.includes(beat.state))
      fail(`${path}.state`, `"${beat.state}" is not a state of this page. States: ${page.states.join(", ")}`);
  });
  // A beat covers the time it takes; what is measured is the longest stretch no beat covers.
  let covered = 0;
  let quiet = 0;
  for (const beat of [...scene.beats].sort((a, b) => a.at - b.at)) {
    quiet = Math.max(quiet, beat.at - covered);
    // Typing takes its length; a line of the film's own takes the time it needs to be read.
    const text = beat.text ?? "";
    const natural =
      { type: text.length * 0.042, say: 0.5 + text.trim().split(/\s+/).length * 0.3 }[beat.do as string] ??
      0.3;
    const length = beat.over ?? natural;
    covered = Math.max(covered, beat.at + length);
  }
  quiet = Math.max(quiet, scene.duration - covered);
  if (quiet > LONGEST_QUIET)
    warn(
      `${at}.beats`,
      `nothing starts for ${quiet.toFixed(1)}s in this take. Above ${LONGEST_QUIET}s an interface reads as a frozen picture; add a beat or shorten the take`,
    );
}
