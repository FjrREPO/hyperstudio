import { readFileSync } from "node:fs";
import { IR } from "@hyperstudio/ir";

// Two films of different products can tell different stories and still look like one template. This reads
// two plans and says, decision by decision, where they made the same choice. It measures the plan, not the
// picture: it cannot see taste, only repetition.

type Film = IR;

const beats = (film: Film) => film.scenes.flatMap((s) => s.beats);
const uniq = (items: (string | undefined)[]) =>
  [...new Set(items.filter((i): i is string => Boolean(i)))].sort();

/** How light a hex colour is, 0 to 1. */
function lightness(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(n.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

type Beats = ReturnType<typeof beats>;
type Params = Film["scenes"][number]["params"][];

function filmType(says: Beats): string {
  if (says.length === 0) return "none on screen";
  return says.some((b) => b.size === "display" || b.size === "hero")
    ? "large lines beside or over the product"
    : "caption sized";
}

function cameraAngle(camera: Beats, params: Params): string {
  const tilts = uniq([...params.map((p) => String(p.tilt ?? "none")), ...camera.map((b) => b.tilt)]).filter(
    (t) => t !== "none",
  );
  return tilts.length === 0 ? "flat and frontal" : `turns: ${tilts.join(", ")}`;
}

function cameraDevices(all: Beats, params: Params): string {
  const used: [string, boolean][] = [
    [
      "focus",
      all.some((b) => b.do === "camera" && b.focus) || params.some((p) => p.focus && p.focus !== "all"),
    ],
    ["scroll", all.some((b) => b.do === "scroll")],
    ["wide lens", params.some((p) => p.lens === "wide")],
    [
      "side placement",
      all.some((b) => b.do === "camera" && b.side) || params.some((p) => p.side && p.side !== "centre"),
    ],
  ];
  return (
    used
      .filter(([, on]) => on)
      .map(([name]) => name)
      .join(", ") || "push and reframe only"
  );
}

function ending(film: Film, all: Beats): string {
  const last = film.scenes[film.scenes.length - 1];
  const veils = all.filter((b) => b.do === "veil");
  if (last?.recipe === "brand-close") return "a brand card";
  if (veils.length > 0 && veils[veils.length - 1]?.target !== "window") return "closes onto the mark";
  const closingLine = all.some((b) => b.do === "say" && b.at > (last?.duration ?? 0) - 5);
  return closingLine ? "the product, with a closing line" : "the product alone";
}

/** The decisions that make up a film's visual language and structure, each as a short phrase. */
export function describe(film: Film): Record<string, string> {
  const all = beats(film);
  const says = all.filter((b) => b.do === "say");
  const params = film.scenes.map((s) => s.params);
  const stage = lightness(String(film.style.background ?? "#000000"));
  const tone = stage > 0.6 ? "light" : stage < 0.25 ? "dark" : "mid";
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return {
    stage: `${tone} stage, light ${String(film.style.light ?? "none")}`,
    "film type": filmType(says),
    typeface: says.length === 0 ? "the product's own only" : String(film.style.displayFont ?? "default"),
    "type placement": uniq(says.map((b) => b.place ?? "left")).join(", ") || "none",
    "product in frame": uniq(
      params.map((p) => (p.chrome === "none" ? "bare, edge to edge" : "in a window on the stage")),
    ).join("; "),
    "camera angle": cameraAngle(
      all.filter((b) => b.do === "camera"),
      params,
    ),
    "camera devices": cameraDevices(all, params),
    "how the product enters": all.some((b) => b.do === "veil" && b.at === 0)
      ? "through one element that opens"
      : "whole, from the first frame",
    structure: `${plural(film.scenes.length, "scene")} (${film.scenes.map((s) => s.recipe).join(", ")}), ${plural(Object.keys(film.screens).length, "screen")}`,
    ending: ending(film, all),
    sound: uniq(film.audio.map((a) => a.role)).join(", ") || "silent",
  };
}

export interface Comparison {
  rows: { decision: string; a: string; b: string; same: boolean }[];
  shared: number;
  of: number;
}

/** Compare two plans decision by decision. */
export function compareFilms(a: Film, b: Film): Comparison {
  const [da, db] = [describe(a), describe(b)];
  const rows = Object.keys(da).map((decision) => ({
    decision,
    a: da[decision] ?? "",
    b: db[decision] ?? "",
    same: da[decision] === db[decision],
  }));
  return { rows, shared: rows.filter((r) => r.same).length, of: rows.length };
}

export const readFilm = (file: string): Film => IR.parse(JSON.parse(readFileSync(file, "utf8")));
