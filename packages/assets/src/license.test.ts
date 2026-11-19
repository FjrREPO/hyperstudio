import assert from "node:assert/strict";
import { test } from "node:test";
import { autoSelectable, gate, licenseStatus } from "./license.ts";

const rights = (license: string, extra: object = {}) => ({ license, ...extra });
const verdicts = (ids: string[]) => ids.map((id) => [id, gate(rights(id)).status, gate(rights(id)).verdict]);

test("free licences pass; attribution is carried", () => {
  assert.deepEqual(verdicts(["CC0-1.0", "PDM", "CC-BY"]), [
    ["CC0-1.0", "cc0", "allowed"],
    ["PDM", "public-domain", "allowed"],
    ["CC-BY", "cc-by", "allowed-with-attribution"],
  ]);
  assert.equal(gate(rights("CC-BY")).attributionRequired, true);
  assert.equal(gate(rights("CC0-1.0")).attributionRequired, false);
});

test("share-alike is never picked automatically", () => {
  const g = gate(rights("CC-BY-SA"));
  assert.deepEqual([g.status, g.verdict, g.shareAlike], ["cc-by-sa", "needs-review", true]);
  assert.equal(autoSelectable(g), false);
});

test("non-commercial and no-derivatives are refused", () => {
  assert.deepEqual(verdicts(["CC-BY-NC", "CC-BY-NC-SA", "CC-BY-ND", "CC-BY-NC-ND"]), [
    ["CC-BY-NC", "non-commercial", "denied"],
    ["CC-BY-NC-SA", "non-commercial", "denied"],
    ["CC-BY-ND", "restricted", "denied"],
    ["CC-BY-NC-ND", "non-commercial", "denied"],
  ]);
});

test("an unrecognised licence needs a person, and is not treated as free", () => {
  const g = gate(rights("some-site-terms-v3"));
  assert.deepEqual([g.status, g.verdict], ["unknown", "needs-review"]);
  assert.equal(autoSelectable(g), false);
});

test("a provider's own licence passes only on its stated facts", () => {
  const free = {
    commercialUse: true,
    derivatives: true,
    redistribution: false,
    attributionRequired: false,
    shareAlike: false,
  } as const;
  assert.equal(licenseStatus(rights("pixabay", { facts: free })), "provider-commercial");
  assert.equal(gate(rights("pixabay", { facts: free })).verdict, "allowed");
  assert.equal(gate(rights("pixabay", { facts: { ...free, commercialUse: false } })).verdict, "denied");
  assert.equal(
    gate(rights("pixabay", { facts: { ...free, derivatives: "unknown" } })).verdict,
    "needs-review",
  );
});

test("editorial-only content is refused whatever its licence", () => {
  assert.equal(gate(rights("CC0-1.0", { editorialOnly: true })).verdict, "denied");
});
