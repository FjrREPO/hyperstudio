# Audio licensing

What you may do with the sound in a film depends on where each clip came from. This is a summary to work from,
not legal advice.

| Source                                                | May a published commercial film use it?         | What you owe                                                                  |
| ----------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| Your own recording                                    | Yes                                             | Consent of anyone whose voice is in it                                        |
| Music or sound you licensed                           | As its licence says                             | As its licence says                                                           |
| CC0 or public-domain audio (via `hyperstudio assets`) | Yes                                             | Nothing                                                                       |
| CC BY audio (via `hyperstudio assets`)                | Yes                                             | The credit line in `LICENSES.json`                                            |
| CC BY-SA, non-commercial, no-derivatives, unknown     | Not selected automatically                      | See [ASSET-LICENSING.md](ASSET-LICENSING.md)                                  |
| System voice (macOS `say`)                            | **No.** Draft only                              | Replace it before publishing                                                  |
| ElevenLabs, Free plan                                 | **No.** The Free plan has no commercial licence | Non-commercial use, with credit to ElevenLabs                                 |
| ElevenLabs, paid plan                                 | Yes, under that plan's licence                  | Its terms; consent for any cloned voice                                       |
| Synthesised effects made here (`make-sfx.mjs`)        | Yes, they are ours                              | Nothing; they are still marked placeholders because they are not sound design |

## Rules HyperStudio applies

- Draft voices and Free-plan output are given `"origin": "placeholder"` in the IR, so every compile lists them.
- `hyperstudio compile` prints the credits a film owes from each asset folder's `LICENSES.json`.
- Unknown is not free. An audio file with no ledger entry is treated as your own, and its rights are yours to know.

## Voices and consent

Do not generate or clone a real person's voice without their consent, and do not use a voice to suggest that
someone said something they did not. ElevenLabs' own terms and voice policies apply on top of this; read them
before publishing work made with a cloned or designed voice.

## Before publishing

1. `hyperstudio compile` shows no placeholder audio.
2. `hyperstudio assets list <film>/assets` shows the credits owed; they are in the film or its description.
3. Every voice is your own, licensed, or generated on a plan that grants a commercial licence.
