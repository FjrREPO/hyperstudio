# Audio engine

`@hyperstudio/audio` and `hyperstudio audio` cover voiceover and dubbing. Mixing, fades and the final encode
stay with HyperFrames and FFmpeg; the IR says what plays when.

Three ways to get a voice, and none of them is required:

| Provider                       | Does                                 | Cost                                    | Output may be used                                           |
| ------------------------------ | ------------------------------------ | --------------------------------------- | ------------------------------------------------------------ |
| **Local files**                | Any recording or audio file you have | None                                    | As your rights to it allow                                   |
| **System voice** (macOS `say`) | Draft voiceover                      | None                                    | Drafts only; it is a placeholder                             |
| **ElevenLabs** (optional)      | Voiceover, dubbing                   | Plan credits: a Free plan or a paid one | Free plan: non-commercial. Paid plan: its commercial licence |

Everything works without ElevenLabs and without the network. See
[ELEVENLABS-INTEGRATION.md](ELEVENLABS-INTEGRATION.md), [AUDIO-COST-CONTROLS.md](AUDIO-COST-CONTROLS.md) and
[AUDIO-LICENSING.md](AUDIO-LICENSING.md).

| Module          | Responsibility                                                               |
| --------------- | ---------------------------------------------------------------------------- |
| `providers.ts`  | The providers, what each costs, and what its output may be used for          |
| `local.ts`      | Read a file's real length and format (`ffprobe`); the system draft voice     |
| `elevenlabs.ts` | The optional client: plan-aware, estimates first, never repeats a generation |
| `cost.ts`       | Estimates from the published price list                                      |

## Commands

```bash
pnpm hyperstudio audio providers                                   # what is available, and on what terms
pnpm hyperstudio audio tts "Ask your revenue a question." --out <film>/assets/vo-1.m4a
pnpm hyperstudio audio tts "Tanyakan pendapatan Anda." --voice Damayanti --out <film>/assets/vo-id.m4a
pnpm hyperstudio audio inspect <file>                              # real length, codec, channels
pnpm hyperstudio audio status                                      # plan credits and what was generated here

# ElevenLabs, only when you name it and ELEVENLABS_API_KEY is set
pnpm hyperstudio audio voices
pnpm hyperstudio audio tts "…" --provider elevenlabs --voice <id> --out <file> --dry-run
pnpm hyperstudio audio tts "…" --provider elevenlabs --voice <id> --out <file> [--confirm-cost]
pnpm hyperstudio audio dub <film.mp4> --lang id [--confirm-cost]
pnpm hyperstudio audio status <job-id> --lang id --out <film>-id.mp3
```

`tts` defaults to the system voice. `--voice` is a system voice name (`say -v '?'` lists them) or an ElevenLabs
voice id.

## Audio in the IR

```json
"audio": [
  { "id": "bed", "src": "assets/bed.mp3", "role": "music", "volume": 0.3, "fadeIn": 0.5, "fadeOut": 2 },
  { "id": "vo-ask", "src": "assets/vo-1.m4a", "role": "voice", "scene": "hook", "start": 0.1, "duration": 2.7 },
  { "id": "sfx", "src": "assets/ui-sfx.m4a", "role": "sfx", "origin": "placeholder" }
]
```

| Field                         | Meaning                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `role`                        | `voice`, `music` (default) or `sfx`                                                                                        |
| `scene`                       | Tie the clip to a scene: `start` then counts from that scene's start, so narration follows the film when shots are retimed |
| `start`, `duration`           | Seconds. Give a voice clip its real `duration` (from `audio inspect`)                                                      |
| `volume`, `fadeIn`, `fadeOut` | Passed to HyperFrames, which mixes                                                                                         |
| `origin`                      | `placeholder` for a draft voice or a stand-in; it is listed by every compile                                               |

The compiler rejects a clip that names an unknown scene, runs past the end of the film, or overlaps another
voice clip (two voices at once cannot both be heard).

## Voiceover or dubbing

- **Voiceover** makes narration for a film you are building. Write the script per shot, generate one clip per
  line, read its length with `audio inspect`, and place it with `scene` and `start`.
- **Dubbing** localises a film that is already finished: it takes the rendered file and returns the audio in
  another language. It is a separate, per-minute cost and only ElevenLabs does it here.

## Verified, and not

Run on 2026-11-19 with no ElevenLabs key:

- English and Indonesian draft voiceover from the system voice.
- A narrated variant of the benchmark film: a CC0 music bed found with `hyperstudio assets`, interface sounds,
  and two voice clips tied to scenes. `hyperframes check` passed; the render is 15.000 s with one AAC track,
  and the voice windows measure about 22 dB louder than the film's silent tail.
- ElevenLabs: refused cleanly with no key. Its request shapes, the three plan modes, quota and confirmation
  are covered by tests against a stand-in for the documented API.

Not verified: any live ElevenLabs call (no key here), so voiceover quality, dubbing, and the dubbed-audio
download path are untested against the real service. Levels were measured, not listened to.

## Limits

- No captions here: use `npx hyperframes transcribe` and the HyperFrames captions workflow.
- No automatic ducking of music under a voice; set `volume` yourself.
- The system voice needs macOS.
- A voice clip's length is not read by the compiler; give `duration`.
