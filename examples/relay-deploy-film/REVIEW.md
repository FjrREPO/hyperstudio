# Review: Relay, the launch film (a third look)

Answered on 2026-11-19 from the rendered file `renders/relay-deploy-film.mp4`: a sheet at one frame a second
and six full frames. Sound was measured, not heard. Relay is an example product made for this film: its
interface, services, commits, log lines and figures are invented, and its sounds are synthesised.

- 27.4 s, 1920×1080, 30 fps, one take. HyperFrames check: 0 errors, 1 warning (frame 0 is nearly empty)
- Motion: 42% of frames still; longest freeze 1.9 s at the start (the prompt before typing ends)
- Sound: eight lines from Kokoro (voice `am_fenrir`) and interface sounds; no music. Mean -22.6 dB, peak -1.5 dB

## The question: is the look different in kind, or in colour?

| Decision             | Lumen                           | Marlow                   | Relay                                           |
| -------------------- | ------------------------------- | ------------------------ | ----------------------------------------------- |
| Stage                | Light stone                     | Light                    | Black, with the interface's glow spilling on it |
| The film's own type  | Serif headlines, six placements | Sans, in a band          | None. Every word on screen is the product's     |
| Who tells it         | Headlines                       | Captions                 | The deploy log and a voice                      |
| Product in the frame | A window on a page              | Flat, edge to edge       | An object, turned, seen past its edge           |
| Camera               | Flat; pushes and reframes       | Flat; travels            | Wide lens; a new angle per stage; square once   |
| Ending               | Closes onto the mark            | Pulls back, name in type | Back on the prompt, typing the install command  |

`hyperstudio compare` on the plans: 0 of 11 decisions shared with Lumen, 4 with Marlow (bare product, present
from the first frame, one take, the same kinds of sound).

What is still shared with both: one recipe (`product-take`), one long take of a live page, a cursor that
clicks, and a pull back to finish. The differences are in how that recipe was directed, not in a new engine.

## Timeline

| Time      | What is on screen                                                      | Verdict                                                                            |
| --------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 0.0-1.9   | The terminal, leaning; `git push origin main` is typed                 | Fair. The prompt is large and readable; the frame above it is still an empty panel |
| 1.9-3.9   | The build log arrives line by line                                     | Fair. Readable, but the log sits low in a large empty panel                        |
| 3.9-6.5   | The pipeline, from the right; build and test light up                  | Good. The stage lines drawing are the clearest motion                              |
| 6.5-10.3  | Canary: the traffic bar at 10%, then the latency line draws            | Fair. The traffic bar fills the frame; the latency card is tall and mostly empty   |
| 10.3-12.1 | The cursor presses Promote                                             | Good                                                                               |
| 12.1-14.4 | The whole interface, square, live                                      | Fair. The one flat frame; its text is small at this size                           |
| 14.4-19.6 | Roll back is pressed; the status is outlined                           | Good, though the status chip is small for what it says                             |
| 19.6-27.4 | The log, then the prompt types `npx relay init`; the camera pulls back | Fair. Ends close on the product's own mark, with part of the breadcrumb beside it  |

## Remaining weaknesses

1. The opening is readable now but not a hook: a prompt under an empty panel. The check still reports the
   first frame as nearly empty.
2. The brand moment is the interface's small mark enlarged, with the breadcrumb cut off beside it. It is a
   frame for the name, not a designed ending.
3. The latency card is mostly empty space, so its shot is too: a weakness of the example page, shown faithfully.
4. With no type, a muted viewer gets the deploy from monospace only. Whether that is enough was not tested.
5. The angles change per stage, but every move is the same kind of move (reframe and turn). Nothing cuts.
6. Nobody has watched it at speed or listened to it. The voice was picked by name. There is no music.
7. The product was written by the same author as the film, so the film cannot have misread it.
