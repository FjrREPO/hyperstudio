import { join } from "node:path";

/** Folder of recipes; each child is `<name>/registry-item.json` + its scene HTML. */
export const RECIPES_DIR = join(import.meta.dirname, "..", "blocks");
