/**
 * @hyperstudio/studio — the whole engine behind one API.
 *
 * Projects, compile, review, renders, assets and audio. The CLI, MCP server, REST API and SDK are thin
 * adapters over this, so nothing is implemented twice.
 */
export { createJobs, type Job, type JobStatus, type Quality } from "./jobs.ts";
export { type Finding, hyperframes, type Review, RUBRIC, reviewFilm } from "./review.ts";
export { createStudio, type Outcome, type Studio, type StudioOptions } from "./studio.ts";
export { createWorkspace, IR_FILE, PROJECT_NAME, type Workspace, WorkspaceError } from "./workspace.ts";
