/**
 * @hyperstudio/assets — find openly licensed media, gate it by licence, and record what was used.
 *
 * Search runs on refkit (Apache-2.0) over free sources. No paid provider, and no key is assumed.
 */
export { createHttp, RateLimitError, USER_AGENT, type UsageEntry, usageSummary } from "./http.ts";
export {
  credits,
  downloadAsset,
  LEDGER,
  type LedgerEntry,
  type LocalAsset,
  listLocalAssets,
  readLedger,
} from "./ledger.ts";
export {
  autoSelectable,
  type Gate,
  gate,
  LICENSE_STATUSES,
  type LicenseStatus,
  licenseStatus,
  type Verdict,
} from "./license.ts";
export {
  type AssetKind,
  EXCLUDED,
  PROVIDERS,
  type ProviderInfo,
  type ProviderStatus,
  providerStatus,
} from "./providers.ts";
export { type Asset, type SearchOptions, type SearchResult, searchAssets, toAsset } from "./search.ts";
