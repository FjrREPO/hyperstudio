import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

// A workspace is one folder; a project is a sub-folder holding video.json. Every path an outside caller can
// reach goes through here, so a caller can never read or write outside the workspace.

export const PROJECT_NAME = /^[a-z][a-z0-9-]{0,62}$/;
export const IR_FILE = "video.json";

export class WorkspaceError extends Error {
  readonly code: "invalid-name" | "not-found" | "exists" | "outside-workspace";

  constructor(code: WorkspaceError["code"], message: string) {
    super(message);
    this.name = "WorkspaceError";
    this.code = code;
  }
}

export interface Workspace {
  readonly root: string;
  /** A project's directory. Throws unless the name is valid and the project exists (or `create` is set). */
  projectDir(name: string, options?: { mustExist?: boolean }): string;
  /** A path inside a project, refusing anything that would leave it. */
  inside(name: string, relativePath: string): string;
  list(): string[];
  create(name: string): string;
  readIr(name: string): unknown;
  writeIr(name: string, ir: unknown): string;
}

export function createWorkspace(root: string): Workspace {
  const base = resolve(root);
  const projectDir = (name: string, { mustExist = true } = {}) => {
    if (!PROJECT_NAME.test(name))
      throw new WorkspaceError(
        "invalid-name",
        `"${name}" is not a project name: use lowercase letters, digits and hyphens`,
      );
    const dir = join(base, name);
    if (mustExist && !existsSync(join(dir, IR_FILE)) && !existsSync(dir))
      throw new WorkspaceError("not-found", `no project named "${name}" in ${base}`);
    return dir;
  };
  return {
    root: base,
    projectDir,
    inside(name, relativePath) {
      const dir = projectDir(name);
      const target = resolve(dir, relativePath);
      if (target !== dir && !target.startsWith(dir + sep))
        throw new WorkspaceError("outside-workspace", `"${relativePath}" is outside the project`);
      return target;
    },
    list() {
      if (!existsSync(base)) return [];
      return readdirSync(base)
        .filter(
          (name) =>
            PROJECT_NAME.test(name) &&
            existsSync(join(base, name, IR_FILE)) &&
            statSync(join(base, name)).isDirectory(),
        )
        .sort();
    },
    create(name) {
      const dir = projectDir(name, { mustExist: false });
      if (existsSync(join(dir, IR_FILE)))
        throw new WorkspaceError("exists", `a project named "${name}" already exists`);
      for (const folder of ["assets", "screens"]) mkdirSync(join(dir, folder), { recursive: true });
      return dir;
    },
    readIr(name) {
      const file = join(projectDir(name), IR_FILE);
      if (!existsSync(file)) throw new WorkspaceError("not-found", `project "${name}" has no ${IR_FILE} yet`);
      return JSON.parse(readFileSync(file, "utf8"));
    },
    writeIr(name, ir) {
      const file = join(projectDir(name), IR_FILE);
      writeFileSync(file, `${JSON.stringify(ir, null, 2)}\n`);
      return file;
    },
  };
}
