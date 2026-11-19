/**
 * @hyperstudio/audio — voiceover and dubbing.
 *
 * Free and local first (your own recordings, a system voice for drafts). ElevenLabs is optional: on its
 * Free plan it runs inside the plan's credits and marks the result non-commercial; on a paid plan it asks.
 */
export { DUB_PRICE_PER_MINUTE, type Estimate, estimateDub, estimateTts, TTS_PRICE_PER_1K } from "./cost.ts";
export {
  ConfirmationRequired,
  createElevenLabs,
  DEFAULT_MODEL,
  MissingKeyError,
  QuotaError,
  type Rights,
  type Spend,
  spendSummary,
  type TtsRequest,
} from "./elevenlabs.ts";
export { type AudioInfo, inspectAudio, systemVoiceover } from "./local.ts";
export {
  AUDIO_PROVIDERS,
  type AudioProviderInfo,
  type AudioProviderStatus,
  audioProviderStatus,
} from "./providers.ts";
