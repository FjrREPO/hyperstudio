import { factsOf, type RightsRecord } from "@refkit/core";

// The licence of a piece of CONTENT, reduced to what a film-maker has to decide on.
// This says nothing about software licences: an open-source SDK does not make what it finds free to use.

export const LICENSE_STATUSES = [
  "cc0",
  "public-domain",
  "cc-by",
  "cc-by-sa",
  "provider-commercial",
  "non-commercial",
  "restricted",
  "unknown",
] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

/** What may be done with an asset in a film that is published commercially. */
export type Verdict = "allowed" | "allowed-with-attribution" | "needs-review" | "denied";

export interface Gate {
  status: LicenseStatus;
  verdict: Verdict;
  /** Why, in one line a person can act on. */
  reason: string;
  attributionRequired: boolean;
  shareAlike: boolean;
}

const PUBLIC_DOMAIN = /^(pdm|public[- ]?domain|pd(-|$)|us-gov|no-known-copyright)/i;

/** Reduce a rights record to one of the statuses above. */
export function licenseStatus(rights: Pick<RightsRecord, "license" | "facts">): LicenseStatus {
  const id = String(rights.license);
  const facts = factsOf(rights);
  if (/^cc0/i.test(id)) return "cc0";
  if (PUBLIC_DOMAIN.test(id)) return "public-domain";
  if (facts.commercialUse === false) return "non-commercial";
  if (facts.derivatives === false) return "restricted";
  if (facts.commercialUse === "unknown" || facts.derivatives === "unknown") return "unknown";
  if (/^cc-by-sa/i.test(id)) return "cc-by-sa";
  if (/^cc-by/i.test(id)) return "cc-by";
  return "provider-commercial";
}

/**
 * Decide whether an asset may be picked automatically for a commercial film.
 * Strict: anything not known to permit commercial use AND modification is held back.
 * A film edits what it uses, so "no derivatives" is a refusal here.
 */
export function gate(rights: Pick<RightsRecord, "license" | "facts" | "editorialOnly">): Gate {
  const status = licenseStatus(rights);
  const facts = factsOf(rights);
  const base = { status, attributionRequired: facts.attributionRequired, shareAlike: facts.shareAlike };
  if (rights.editorialOnly)
    return { ...base, verdict: "denied", reason: "marked editorial-only by its source; not for advertising" };
  switch (status) {
    case "cc0":
    case "public-domain":
      return { ...base, verdict: "allowed", reason: "no rights reserved" };
    case "cc-by":
      return {
        ...base,
        verdict: "allowed-with-attribution",
        reason: "credit the author in the film or beside it",
      };
    case "cc-by-sa":
      return {
        ...base,
        verdict: "needs-review",
        reason: "share-alike: a film that adapts it may have to be released under the same licence",
      };
    case "provider-commercial":
      return {
        ...base,
        verdict: facts.attributionRequired ? "allowed-with-attribution" : "allowed",
        reason: "allowed by the provider's own licence; read its limits (trademarks, people, resale)",
      };
    case "non-commercial":
      return { ...base, verdict: "denied", reason: "non-commercial licence" };
    case "restricted":
      return { ...base, verdict: "denied", reason: "no derivatives: it cannot be edited into a film" };
    default:
      return { ...base, verdict: "needs-review", reason: "the licence could not be determined" };
  }
}

/** True when an asset may be selected without a person looking at its licence. */
export const autoSelectable = (g: Gate) =>
  g.verdict === "allowed" || g.verdict === "allowed-with-attribution";
