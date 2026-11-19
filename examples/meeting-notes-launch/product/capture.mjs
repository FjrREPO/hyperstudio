#!/usr/bin/env node
// Screenshot each state of the example product and record where its named components are.
// Usage: node product/capture.mjs        (needs Google Chrome; set CHROME to its binary if it is elsewhere)
// Writes screens/<state>.png (2x) and screens/regions.json.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const STATES = ["meeting", "summary", "done", "sent"];
const SIZE = { width: 1440, height: 900 };
const here = import.meta.dirname;
const out = join(here, "..", "screens");
const page = pathToFileURL(join(here, "index.html")).href;
const base = [
  "--headless=new",
  "--hide-scrollbars",
  "--virtual-time-budget=5000",
  `--window-size=${SIZE.width},${SIZE.height}`,
];

mkdirSync(out, { recursive: true });
const regions = {};
for (const state of STATES) {
  const url = `${page}#${state}`;
  execFileSync(
    CHROME,
    [...base, "--force-device-scale-factor=2", `--screenshot=${join(out, `${state}.png`)}`, url],
    { stdio: "ignore" },
  );
  const dom = execFileSync(CHROME, [...base, "--dump-dom", url], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const json = /<script type="application\/json" id="hs-regions">([^<]*)<\/script>/.exec(dom)?.[1];
  if (!json) throw new Error(`${state}: the page did not publish its regions`);
  regions[state] = { ...SIZE, regions: JSON.parse(json.replaceAll("&quot;", '"')) };
  console.log(`${state}: ${Object.keys(regions[state].regions).length} regions`);
}
writeFileSync(join(out, "regions.json"), `${JSON.stringify(regions, null, 2)}\n`);
