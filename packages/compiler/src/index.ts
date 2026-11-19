/**
 * @hyperstudio/compiler — Creative IR in, HyperFrames project out.
 *
 * This package is the only place that knows HyperFrames' format.
 */
export { type CompileOptions, type CompileResult, compile } from "./compile.ts";
export { CompileError, type Issue } from "./errors.ts";
export { listRecipes, type RecipeMeta, type Variable } from "./recipes.ts";
