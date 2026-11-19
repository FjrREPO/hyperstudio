import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { HYPERFRAMES } from "./review.ts";

// A render takes from seconds to minutes, so it runs as a background job: start it, get an id, ask later.
// A job is a process plus a small JSON record; its log is the HyperFrames CLI's own output.

export interface Job {
  id: string;
  kind: "render";
  project: string;
  pid: number;
  output: string;
  log: string;
  startedAt: string;
}

export interface JobStatus extends Job {
  state: "running" | "done" | "failed" | "cancelled";
  /** Size of the output so far, in bytes. */
  bytes: number;
  /** The last lines of the log: what HyperFrames last said. */
  tail: string;
}

const QUALITIES = ["draft", "looks", "delivery"] as const;
export type Quality = (typeof QUALITIES)[number];

export function createJobs(stateDir: string) {
  const dir = join(stateDir, "jobs");
  const file = (id: string) => join(dir, `${id}.json`);
  const alive = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const read = (id: string): Job & { cancelled?: boolean } => {
    if (!(/^[a-z0-9-]+$/.test(id) && existsSync(file(id)))) throw new Error(`no job with id "${id}"`);
    return JSON.parse(readFileSync(file(id), "utf8"));
  };

  return {
    /** Start rendering a compiled project. Returns at once. */
    startRender(project: string, buildDir: string, output: string, quality: Quality = "looks"): Job {
      if (!QUALITIES.includes(quality)) throw new Error(`quality must be one of: ${QUALITIES.join(", ")}`);
      if (!existsSync(join(buildDir, "index.html")))
        throw new Error(`"${project}" is not compiled yet; compile it first`);
      mkdirSync(dir, { recursive: true });
      const id = `render-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const log = join(dir, `${id}.log`);
      const out = openSync(log, "w");
      const child = spawn("npx", ["-y", HYPERFRAMES, "render", "--quality", quality, "-o", output], {
        cwd: buildDir,
        detached: true,
        stdio: ["ignore", out, out],
      });
      child.unref();
      closeSync(out);
      const job: Job = {
        id,
        kind: "render",
        project,
        pid: child.pid ?? 0,
        output,
        log,
        startedAt: new Date().toISOString(),
      };
      writeFileSync(file(id), JSON.stringify(job, null, 2));
      return job;
    },

    status(id: string): JobStatus {
      const job = read(id);
      const tail = existsSync(job.log)
        ? readFileSync(job.log, "utf8").trim().split("\n").slice(-4).join("\n")
        : "";
      const bytes = existsSync(job.output) ? statSync(job.output).size : 0;
      const finished = /rendered in|Render complete/i.test(tail) && bytes > 0;
      const state = job.cancelled
        ? "cancelled"
        : alive(job.pid) && !finished
          ? "running"
          : finished
            ? "done"
            : "failed";
      return { ...job, state, bytes, tail };
    },

    /** Stop a running job. Stopping one that already ended changes nothing. */
    cancel(id: string): JobStatus {
      const job = read(id);
      if (alive(job.pid)) {
        try {
          process.kill(-job.pid, "SIGTERM"); // the whole process group: npx starts children
        } catch {
          process.kill(job.pid, "SIGTERM");
        }
        writeFileSync(file(id), JSON.stringify({ ...job, cancelled: true }, null, 2));
      }
      return this.status(id);
    },

    list(): JobStatus[] {
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => this.status(f.replace(/\.json$/, "")))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    },
  };
}
