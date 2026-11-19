# Audio cost controls

What stops HyperStudio from spending credits or money on audio without you meaning it to.

| Control                        | Behaviour                                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Nothing paid by default        | `audio tts` uses the system voice unless `--provider elevenlabs` is given                                                              |
| No key, no call                | Without `ELEVENLABS_API_KEY` nothing is sent; the command says so and exits 1                                                          |
| Plan read first                | Before generating, the account's tier and remaining credits are read (a free call)                                                     |
| Estimate first                 | `--dry-run` prints the credits a request would use and its list price, and generates nothing                                           |
| Free plan stays free           | On the Free plan a request runs only if the remaining credits cover it                                                                 |
| Never exceeded, never upgraded | A request larger than the credits left is refused with both numbers. No plan is changed, ever                                          |
| Paid plans ask                 | On any other tier, generation needs `--confirm-cost`; without it the estimate is printed and nothing runs                              |
| Unknown plan asks              | If the plan cannot be read, it is treated as paid                                                                                      |
| No repeats                     | A request identical in text, voice, model and settings returns the audio already generated; it costs nothing and needs no confirmation |
| A record                       | Each generation and each avoided repeat is appended to `.hyperstudio/audio-spend.jsonl`; `audio status` totals it                      |
| Provider errors are named      | A rejected key (401) and a quota or rate limit are reported as such, not as a generic failure                                          |
| The key stays out of files     | It is sent as a header only; the log and cache never contain it (covered by a test)                                                    |

Estimates use the price list in `packages/audio/src/cost.ts`, taken from ElevenLabs' pricing pages on
2026-11-19. They are a guide for deciding whether to proceed, not an invoice; the account's own usage page is
the authority.

An agent using HyperStudio must not pass `--confirm-cost` on its own. It shows the estimate and asks the
person. The skill says so.
