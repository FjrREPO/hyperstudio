import { styleText } from "node:util";

// Terminal output helpers. Colour is dropped automatically when stdout is not a terminal or NO_COLOR is set.

type Style = Parameters<typeof styleText>[0];
const paint = (style: Style, text: string) => styleText(style, text, { stream: process.stdout });

export const bold = (text: string) => paint("bold", text);
export const dim = (text: string) => paint("dim", text);
export const green = (text: string) => paint("green", text);
export const red = (text: string) => paint("red", text);
export const yellow = (text: string) => paint("yellow", text);

/** Left-aligned columns, each as wide as its widest cell. */
export function table(rows: string[][], indent = "  "): string {
  const widths: number[] = [];
  for (const row of rows)
    for (const [i, cell] of row.entries()) widths[i] = Math.max(widths[i] ?? 0, cell.length);
  return rows
    .map(
      (row) =>
        indent + row.map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i] ?? 0))).join("  "),
    )
    .join("\n");
}

/** Shorten to `max` characters with an ellipsis. */
export const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Print a value as JSON, indented when asked. */
export const printJson = (value: unknown, pretty: boolean) =>
  console.log(JSON.stringify(value, null, pretty ? 2 : undefined));
