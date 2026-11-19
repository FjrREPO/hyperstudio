# ElevenLabs integration

ElevenLabs is an **optional** provider for voiceover and dubbing. It is a closed service, not open source.
It has a Free plan and paid plans, and HyperStudio behaves differently on each. Nothing in HyperStudio needs it.

Facts below are from ElevenLabs' own pages as read on 2026-11-19. Where a page could not be read, that is
said. Plans and prices change: check https://elevenlabs.io/pricing before relying on any figure.

## Setup

```bash
export ELEVENLABS_API_KEY=…        # in your shell, never in a film's files
pnpm hyperstudio audio status      # shows the plan and the credits left
```

The key is read from the environment and sent only as the `xi-api-key` request header. It is never written to
the IR, to a compiled project, to the generation cache or to a log.

## Three modes

|                      | Free plan                                       | Paid plan                            | No key                                       |
| -------------------- | ----------------------------------------------- | ------------------------------------ | -------------------------------------------- |
| How it is detected   | `GET /v1/user/subscription` returns tier `free` | Any other tier                       | `ELEVENLABS_API_KEY` unset                   |
| Voiceover            | Runs inside the remaining credits               | Needs `--confirm-cost`               | Refused; use local audio or the system voice |
| When credits run out | Refused with the numbers; nothing is upgraded   | Refused the same way                 |                                              |
| Output marked        | **Non-commercial**                              | Commercial, under the plan's licence |                                              |
| Dubbing              | Requested with a watermark                      | Needs `--confirm-cost`, no watermark | Refused                                      |

If the plan cannot be read, HyperStudio treats it as paid (it asks first) and marks the output non-commercial
until you confirm your licence.

## What the plans are (as published)

| Fact                                                                                                        | Source                |
| ----------------------------------------------------------------------------------------------------------- | --------------------- |
| A Free plan exists: $0, 10,000 credits a month                                                              | Pricing page          |
| Voiceover costs 1 credit per character on the standard models                                               | Pricing page FAQ      |
| The Free plan lists Text to Speech, Speech to Text, Sound Effects, Voice Design and Music                   | Pricing page          |
| "Commercial License" first appears in the Starter plan, so the Free plan has none                           | Pricing page          |
| Voice cloning starts at Starter                                                                             | Pricing page          |
| Pay-as-you-go API voiceover: $0.08 per 1,000 characters (multilingual v2, v3), $0.04 (Flash, Turbo)         | API pricing page      |
| Dubbing is billed per source minute; "free-tier dubs are watermarked automatically; paid-tier dubs are not" | Dubbing documentation |
| Three dubbing jobs may run at once on self-serve plans                                                      | Dubbing documentation |

Not confirmed from a page we could read: whether the Free plan requires attribution (the help article
returned 403; the owner reports that it does), and whether the Free plan includes dubbing through the API.
HyperStudio's note on Free-plan output says to credit ElevenLabs, which is the safe reading.

## Endpoints used

| Purpose          | Request                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan and credits | `GET /v1/user/subscription` → `tier`, `character_count`, `character_limit`                                                                                                               |
| Voices           | `GET /v2/voices?page_size=50&search=…`                                                                                                                                                   |
| Voiceover        | `POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128` with `text`, `model_id`, optional `language_code`, `voice_settings` (`stability`, `similarity_boost`, `style`, `speed`) |
| Start a dub      | `POST /v1/dubbing` (multipart: `file`, `target_lang`, optional `source_lang`, `watermark`) → `dubbing_id`, `expected_duration_sec`                                                       |
| Dub status       | `GET /v1/dubbing/{dubbing_id}` → `status` (`dubbed` when finished), `target_languages`, `error`                                                                                          |
| Dubbed audio     | `GET /v1/dubbing/{dubbing_id}/audio/{language_code}` — **unverified**: its reference page returned 403                                                                                   |

The default model is `eleven_multilingual_v2`. `language_code` is passed when given; the documentation says
models that do not support it ignore it. Indonesian is listed for dubbing; which voiceover models speak it is
not stated per model on the pages read, so check the result.

The documentation describes "Dubbing v2" as alpha and links the create and status references under a "legacy"
path, without marking `POST /v1/dubbing` deprecated or giving a different v2 endpoint. HyperStudio uses the
documented endpoints above. Editing and regenerating a dub through the API is Enterprise-only and is not
implemented.

## Not implemented

Voice Design, voice cloning, sound-effect and music generation, speech to text, streaming, pronunciation
dictionaries, dub transcript editing.

## Tested live

On 2026-11-19 with a real key on the **Free plan**:

- `GET /v1/user/subscription`: answered; the account read as tier `free` with 10,000 of 10,000 credits used.
- `GET /v2/voices`: answered with the account's voices.
- Voiceover: **refused by HyperStudio before any request was sent**, because the plan had no credits left
  ("The free plan has 0 credits left and this needs 44. Nothing was generated."). That is the intended
  behaviour, and it means the generation request itself has still not been made against the real service.

Not yet exercised against the real service: voiceover generation, a paid plan's confirmation path, and all of
dubbing. Those are covered by tests against a stand-in that answers like the documented API.
