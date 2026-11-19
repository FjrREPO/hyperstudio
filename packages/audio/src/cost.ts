// Prices as published on https://elevenlabs.io/pricing/api on 2026-11-19, in US dollars.
// They change. An estimate is a guide for deciding whether to proceed, not an invoice.

/** Voiceover: dollars per 1,000 characters, by model id. */
export const TTS_PRICE_PER_1K: Record<string, number> = {
  eleven_multilingual_v2: 0.08,
  eleven_v3: 0.08,
  eleven_flash_v2_5: 0.04,
  eleven_turbo_v2_5: 0.04,
};
/** Dubbing: dollars per minute of source audio. */
export const DUB_PRICE_PER_MINUTE = { v1: 0.5, v1Watermarked: 0.33, v2: 2.2 } as const;

export interface Estimate {
  /** What is being generated. */
  what: string;
  /** Plan credits it uses. Voiceover is 1 credit per character on the standard models. */
  credits?: number;
  /** What it costs through the pay-as-you-go API price list. On a plan, credits are what is drawn down. */
  usd: number;
  /** How the figure was reached. */
  basis: string;
  /** True when the price for this exact request is not in the table and a default was used. */
  approximate: boolean;
}

export function estimateTts(text: string, model: string): Estimate {
  const known = TTS_PRICE_PER_1K[model];
  const rate = known ?? Math.max(...Object.values(TTS_PRICE_PER_1K));
  return {
    what: `${text.length} characters of voiceover with ${model}`,
    credits: text.length,
    usd: Number(((text.length / 1000) * rate).toFixed(4)),
    basis: `$${rate} per 1,000 characters${known === undefined ? " (model not in the price table; highest listed rate used)" : ""}`,
    approximate: known === undefined,
  };
}

export function estimateDub(
  sourceSeconds: number,
  version: keyof typeof DUB_PRICE_PER_MINUTE = "v1",
): Estimate {
  const rate = DUB_PRICE_PER_MINUTE[version];
  return {
    what: `dubbing ${(sourceSeconds / 60).toFixed(2)} minutes of source audio into one language`,
    usd: Number(((sourceSeconds / 60) * rate).toFixed(4)),
    basis: `$${rate} per source minute (${version}); billed per target language`,
    approximate: false,
  };
}
