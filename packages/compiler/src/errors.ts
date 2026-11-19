/** One problem with an IR: where it is (a dotted path into the document) and what to do about it. */
export interface Issue {
  path: string;
  message: string;
}

/** Thrown when an IR is rejected. Carries every problem found, not just the first. */
export class CompileError extends Error {
  readonly issues: Issue[];

  constructor(issues: Issue[]) {
    super(issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("\n"));
    this.name = "CompileError";
    this.issues = issues;
  }
}
