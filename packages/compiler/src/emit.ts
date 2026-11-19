import type { IR } from "@hyperstudio/ir";
import type { Variable } from "./recipes.ts";

// Everything here writes HyperFrames' own format: scene hosts with data-* timing and
// data-variable-values, plain <audio> clips, one paused root timeline, and a STORYBOARD.md.

export const MARKER = "<!-- hyperstudio:generated - edit the IR and recompile, do not edit here -->";
/** Same pin as `hyperframes init` 0.9.69. */
const GSAP_URL = "https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js";

export interface PlannedScene {
  id: string;
  recipe: string;
  purpose: string;
  html: string;
  variables: Variable[];
  values: Record<string, string | number | boolean>;
  /** A live page for the scene to mount: its styles and markup. */
  payload?: { css: string; html: string };
  /** Start and length in seconds. */
  start: number;
  duration: number;
  transition: { type: "cut" | "fade" | "crossfade"; duration: number };
}

export interface PlannedAudio {
  id: string;
  src: string;
  start: number;
  duration: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export interface Film {
  title: string;
  width: number;
  height: number;
  duration: number;
  /** The stage every scene sits on. */
  background: string;
  /** `soft`: one pale light. `aurora`: slow coloured glows, a vignette and grain, for a stage with depth. */
  light: "none" | "soft" | "aurora";
  /** Colours of the aurora's glows: the film's accent, then its optional second hue. */
  glows: string[];
  scenes: PlannedScene[];
  audio: PlannedAudio[];
}

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
/** JSON for a single-quoted attribute. */
const jsonAttr = (v: unknown) =>
  JSON.stringify(v).replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/</g, "&lt;");
const round = (n: number) => Number(n.toFixed(6));

/** The root composition: the stage, one host per scene, audio, and the transitions. */
export function renderIndex(film: Film): string {
  const { width, height, duration } = film;

  const hosts = film.scenes.map(
    (s, i) =>
      `      <div id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html"` +
      ` data-start="${s.start}" data-duration="${s.duration}" data-track-index="${(i % 2) + 1}"` +
      ` data-track-kind="graphics" data-width="${width}" data-height="${height}"` +
      ` data-variable-values='${jsonAttr(s.values)}' style="z-index: ${i + 1}"></div>`,
  );
  const audio = film.audio.map(
    (a, i) =>
      `      <audio id="${a.id}" class="clip" src="${attr(a.src)}" data-start="${a.start}" data-duration="${a.duration}"` +
      ` data-track-index="${3 + i}" data-volume="${a.volume}"` +
      (a.fadeIn ? ` data-fade-in="${a.fadeIn}"` : "") +
      (a.fadeOut ? ` data-fade-out="${a.fadeOut}"` : "") +
      "></audio>",
  );

  // Each transition is one tween on one element, so seeking in any order is safe.
  const dips: string[] = [];
  const tweens: string[] = [];
  film.scenes.forEach((s, i) => {
    const d = s.transition.duration;
    if (s.transition.type === "crossfade") {
      tweens.push(
        `tl.fromTo("#${s.id}", { opacity: 0 }, { opacity: 1, duration: ${d}, ease: "power1.inOut" }, ${s.start});`,
      );
    } else if (s.transition.type === "fade") {
      dips.push(`      <div id="hs-dip-${s.id}" class="hs-dip"></div>`);
      tweens.push(
        i === 0
          ? `tl.fromTo("#hs-dip-${s.id}", { opacity: 1 }, { opacity: 0, duration: ${d}, ease: "power2.out" }, 0);`
          : `tl.fromTo("#hs-dip-${s.id}", { opacity: 0 }, { keyframes: [{ opacity: 1, duration: ${d / 2}, ease: "power2.in" }, { opacity: 0, duration: ${d / 2}, ease: "power2.out" }] }, ${round(s.start - d / 2)});`,
      );
    }
  });
  // One light, moving once across the whole film: the stage is what makes separate shots one place.
  if (film.light === "soft")
    tweens.push(
      `tl.fromTo("#hs-light", { xPercent: -8, yPercent: -4 }, { xPercent: 8, yPercent: 4, duration: ${duration}, ease: "none" }, 0);`,
    );

  const aurora = film.light === "aurora" ? auroraStage(film) : null;
  if (aurora) tweens.push(...aurora.tweens);
  const light =
    film.light === "soft"
      ? '<div id="hs-light" data-layout-allow-overflow data-layout-allow-occlusion></div>'
      : (aurora?.html ?? "");

  return `<!doctype html>
${MARKER}
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${attr(film.title)}</title>
    <script src="${GSAP_URL}"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: ${film.background}; }
      #root { position: relative; width: 100%; height: 100%; }
      #hs-stage { position: absolute; inset: 0; overflow: hidden; background: ${film.background}; pointer-events: none; }
      #hs-light { position: absolute; left: -20%; top: -30%; width: 110%; height: 130%; pointer-events: none;
        background: radial-gradient(closest-side, color-mix(in srgb, ${film.background} 55%, white), transparent); }
${aurora?.css ?? ""}      .hs-dip { position: absolute; inset: 0; background: ${film.background}; opacity: 0; z-index: 1000; pointer-events: none; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${duration}" data-width="${width}" data-height="${height}">
      <div id="hs-stage" data-layout-allow-occlusion>${light}</div>
${[...hosts, ...audio, ...dips].join("\n")}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
${tweens.map((t) => `      ${t}`).join("\n")}
      tl.set({}, {}, ${duration});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

/** Fine static grain, so large soft gradients do not band and the stage reads as a surface. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 .5 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * The aurora stage: three large glows that drift once across the film, under a vignette and grain.
 * Each glow is one element with one tween, so any frame can be drawn on its own.
 */
function auroraStage(film: Film): { css: string; html: string; tweens: string[] } {
  const [a = "#ffffff", b = a] = film.glows;
  // Position, size (in % of the frame), colour, strength, and how far each drifts.
  const glows = [
    { left: -18, top: -34, w: 78, h: 110, colour: a, mix: 46, dx: 9, dy: 6 },
    { left: 48, top: 22, w: 82, h: 118, colour: b, mix: 38, dx: -8, dy: -7 },
    { left: 14, top: 58, w: 60, h: 80, colour: a, mix: 22, dx: 6, dy: -5 },
  ];
  const allow = "data-layout-allow-overflow data-layout-allow-occlusion";
  const css = `${glows
    .map(
      (g, i) =>
        `      #hs-glow-${i} { position: absolute; left: ${g.left}%; top: ${g.top}%; width: ${g.w}%; height: ${g.h}%; pointer-events: none;
        background: radial-gradient(closest-side, color-mix(in srgb, ${g.colour} ${g.mix}%, transparent), transparent); }\n`,
    )
    .join("")}      #hs-vignette { position: absolute; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse at 50% 46%, transparent 42%, color-mix(in srgb, ${film.background} 62%, black) 118%); }
      #hs-grain { position: absolute; inset: 0; pointer-events: none; opacity: 0.16; mix-blend-mode: overlay; background: ${GRAIN}; }\n`;
  const html = `${glows.map((_, i) => `<div id="hs-glow-${i}" ${allow}></div>`).join("")}<div id="hs-vignette" ${allow}></div><div id="hs-grain" ${allow}></div>`;
  const tweens = glows.map(
    (g, i) =>
      `tl.fromTo("#hs-glow-${i}", { xPercent: ${-g.dx}, yPercent: ${-g.dy} }, { xPercent: ${g.dx}, yPercent: ${g.dy}, duration: ${film.duration}, ease: "sine.inOut" }, 0);`,
  );
  return { css, html, tweens };
}

/**
 * One scene file from a recipe. A recipe uses its own name as composition id and as the prefix of every
 * element id, so renaming that one token gives each scene a unique scope and a recipe can be used many times.
 */
export function instantiate(scene: PlannedScene, width: number, height: number): string {
  let html = scene.html.replaceAll(scene.recipe, scene.id);
  // The page goes in as JSON on one line; `<` is escaped so no markup in it can end the script element.
  if (scene.payload)
    html = html.replace(
      `id="${scene.id}-ui">{}</script>`,
      () => `id="${scene.id}-ui">${JSON.stringify(scene.payload).replace(/</g, "\\u003c")}</script>`,
    );
  const rootTag = new RegExp(`<div\\b[^>]*\\bdata-composition-id="${scene.id}"[^>]*>`).exec(html);
  if (!rootTag)
    throw new Error(`recipe ${scene.recipe}: no <div data-composition-id="${scene.recipe}"> root element`);
  const set = (tag: string, name: string, value: string, quote = '"') => {
    const existing = new RegExp(`\\s${name}=("[^"]*"|'[^']*')`);
    const next = ` ${name}=${quote}${value}${quote}`;
    return existing.test(tag) ? tag.replace(existing, next) : tag.replace(/>$/, `${next}>`);
  };
  let tag = rootTag[0];
  tag = set(tag, "data-duration", String(scene.duration));
  tag = set(tag, "data-width", String(width));
  tag = set(tag, "data-height", String(height));
  tag = set(tag, "data-composition-variables", jsonAttr(scene.variables), "'");
  // The scene file is generated, not edited: the recipe's explanations stay in the recipe. Dropping whole-line
  // comments and blank lines keeps each scene small enough for HyperFrames' own size check.
  const lean = html
    .replace(rootTag[0], tag)
    .replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*\n/gm, "")
    .replace(/^[ \t]*\/\/.*\n/gm, "")
    .replace(/^[ \t]*\/\*.*\*\/[ \t]*\n/gm, "")
    .replace(/\n[ \t]*\n/g, "\n");
  return lean.replace(/<template>/, `<template>\n  ${MARKER}`);
}

/** The plan beside the project, in the STORYBOARD.md format HyperFrames reads. */
export function renderStoryboard(ir: IR, film: Film): string {
  const d = ir.direction;
  const frames = film.scenes.map(
    (s, i) => `## Frame ${i + 1} — ${s.id}

- status: built
- src: compositions/${s.id}.html
- duration: ${s.duration}s
- transition_in: ${s.transition.type}
- recipe: ${s.recipe}
- scene: ${s.purpose}
`,
  );
  return `---
format: ${film.width}x${film.height}
duration: ${film.duration}s
message: ${JSON.stringify(d.message)}
audience: ${JSON.stringify(d.audience)}
brand: ${JSON.stringify(`${ir.brand.name} (${ir.brand.kind})`)}
---

# ${film.title}

Generated by HyperStudio from the Creative IR. Edit the IR, not this file.

## Direction

- **Concept:** ${d.concept}
- **Tone:** ${d.tone}
- **Palette:** ${d.palette}
- **Typography:** ${d.typography}
- **Motion:** ${d.motion}
- **Pacing:** ${d.pacing}

${frames.join("\n")}`;
}
