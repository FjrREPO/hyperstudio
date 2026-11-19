import type { ReferenceProvider } from "@refkit/core";
import { openverse, openverseAudio } from "@refkit/provider-openverse";
import { pixabay, pixabayVideo } from "@refkit/provider-pixabay";
import { polyhaven } from "@refkit/provider-polyhaven";

// The approved sources. Each entry records the terms that matter, so the policy is data, not folklore.
// Facts verified from each provider's own documentation on 2026-11-19; see docs/ASSET-LICENSING.md.

export type AssetKind = "image" | "audio" | "video";

export interface ProviderInfo {
  /** Source ids this provider serves. */
  sources: string[];
  name: string;
  kinds: AssetKind[];
  /** Environment variable holding its key, when it needs one. */
  keyEnv?: string;
  softwareLicence: string;
  contentLicence: string;
  terms: string;
  /** Rules a caller must follow. */
  rules: string[];
}

export const PROVIDERS: ProviderInfo[] = [
  {
    sources: ["openverse", "openverse-audio"],
    name: "Openverse",
    kinds: ["image", "audio"],
    softwareLicence: "MIT (API); Apache-2.0 (refkit adapter)",
    contentLicence: "Per item: Creative Commons or public domain. Check every result",
    terms: "https://docs.openverse.org/terms_of_service.html",
    rules: [
      "Licence metadata is aggregated from other sites; confirm it on the item's own page before publishing",
      "No scraping; anonymous use is rate limited and returns HTTP 429 when exceeded",
    ],
  },
  {
    sources: ["polyhaven", "polyhaven-hdri"],
    name: "Poly Haven",
    kinds: ["image"],
    softwareLicence: "AGPL-3.0 (their API server, not used here); Apache-2.0 (refkit adapter)",
    contentLicence: "CC0 for every asset",
    terms: "https://github.com/Poly-Haven/Public-API/blob/master/ToS.md",
    rules: [
      "Every request needs a unique User-Agent naming the application",
      "When results from the live API are shown, say they come from Poly Haven",
    ],
  },
  {
    sources: ["pixabay", "pixabay-video"],
    name: "Pixabay",
    kinds: ["image", "video"],
    keyEnv: "PIXABAY_API_KEY",
    softwareLicence: "Proprietary API, free with an account; Apache-2.0 (refkit adapter)",
    contentLicence: "Pixabay Content License: free for commercial use, with limits",
    terms: "https://pixabay.com/service/terms/",
    rules: [
      "100 requests per 60 seconds per key; responses must be cached for 24 hours",
      "No systematic mass downloads; no permanent hotlinking, so download what is used",
      "Not for commercial use when the content shows recognisable trademarks, logos or brands",
      "Never sold or redistributed on its own",
    ],
  },
];

/** Sources left out on purpose, and why. */
export const EXCLUDED = [
  { name: "Freesound API", reason: "its API terms allow non-commercial use only" },
  { name: "Pexels API", reason: "new API keys are not being issued; terms to be reviewed when they are" },
  { name: "LottieFiles premium", reason: "paid assets" },
  { name: "Paid stock libraries", reason: "subscription or per-asset payment" },
];

export interface ProviderStatus extends ProviderInfo {
  available: boolean;
  /** Why it is not available, when it is not. */
  reason?: string;
}

/** Which approved providers can be used right now. A missing key skips a provider; it never fails a search. */
export function providerStatus(env: NodeJS.ProcessEnv = process.env): ProviderStatus[] {
  return PROVIDERS.map((p) => {
    const missing = p.keyEnv !== undefined && !env[p.keyEnv];
    return missing
      ? { ...p, available: false, reason: `set ${p.keyEnv} to enable it` }
      : { ...p, available: true };
  });
}

/** The refkit providers for everything that is available. */
export function activeProviders(env: NodeJS.ProcessEnv = process.env): ReferenceProvider[] {
  const providers: ReferenceProvider[] = [
    openverse(),
    openverseAudio(),
    polyhaven(),
    polyhaven({ assetType: "hdris" }),
  ];
  const key = env.PIXABAY_API_KEY;
  if (key) providers.push(pixabay({ key }), pixabayVideo({ key }));
  return providers;
}
