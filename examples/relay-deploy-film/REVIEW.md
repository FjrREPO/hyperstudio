# Review: Relay, the launch film (rebuilt as a deploy journey)

Written on 2026-11-19 from the rendered file `renders/relay-deploy-film.mp4`: a sheet at one frame a second.
This is an author's inspection of still frames and level meters. It is not a review of the film: nobody has
watched it at speed or listened to it. Relay is an example product; its three views, code, logs and figures
are invented, and its sounds are synthesised.

The first version (one dashboard, a camera circling it) was judged worse than Lumen and Marlow: "dashboard,
zoom, dashboard, zoom, terminal, logo". The cause was the plan, not the polish: one page cannot show a
journey. This version gives each milestone its own picture.

- 28.0 s, 1920×1080, 30 fps, four scenes. HyperFrames check: 0 errors, 1 warning (first frame)
- 15% of frames still (was 42%); longest freeze 1.9 s, on the name at the end

## Timeline

| Time      | Milestone      | What is on screen                                                           |
| --------- | -------------- | --------------------------------------------------------------------------- |
| 0.0-2.4   | A line changes | Line 15 of `retry.ts`, large; the new code is typed; the margin turns green |
| 2.4-6.4   | Pushed         | The editor and its terminal; `git push origin main`; "deploy started"       |
| 6.4-8.7   | Built          | A build log arriving line by line over a filling bar                        |
| 8.7-12.6  | Tested         | Six shards fill; "412 passed"                                               |
| 12.6-17.1 | Canary         | Thirty machines, three turn green; traffic reads 10%; the health line draws |
| 17.1-20.2 | Rolling out    | Fifteen are green; traffic reads 50%                                        |
| 20.2-25.2 | Live (payoff)  | Promote is clicked; the rest turn; 100%; "live in 3 regions"; held          |
| 25.2-28.0 | The name       | Mark, "Relay", "Ship in steps. Watch every one."                            |

## Three dimensions

### 1. Visual and art direction: inspected from stills only

- Works: each milestone is recognisably a different picture; the fleet turning green reads at thumbnail size.
- Weak: at 2.4 to 6.4 s the editor and terminal sit in the top of the frame with the lower half empty.
- Weak: at 6.4 to 8.7 s the build log is four lines in a mostly empty frame.
- Weak: the closing card is the stock ending recipe in dark colours, not something made for Relay.
- Weak: the first frame is line 15 before anything is typed; the check reports it as nearly empty.

### 2. Motion and editing: NOT validated

Stills cannot show timing, the cuts between scenes, or whether the camera steps feel motivated. Known from
the plan only: three hard cuts and one fade; the rollout scene turns the fleet left, right and up, which may
read as restless.

### 3. Audio and sound design: NOT validated

Seven lines from Kokoro (voice `am_fenrir`, picked by name), synthesised interface sounds, no music. Mean
-22.9 dB, peak -1.3 dB. Sync was placed from clip lengths and beat times, not checked by ear.

## The user's review of this render (2026-11-19, from its frame sequence)

Storytelling, art direction, composition and visual progression: good. Motion timing and sound: not judged
(no direct playback, not listened to). Brand ending: needs strengthening. Four notes, none acted on yet:

1. The opening is relevant but has no hook for someone who does not read code.
2. The testing section is repetitive: bars filling for several seconds with little variation.
3. The canary rollout is the best part but could be more dramatic: it should feel like a process under way,
   not a number and boxes increasing.
4. The ending is abrupt: from the 100% dashboard to the logo with no emotional payoff.

Decision: a benchmark candidate, not final. Do not change the art direction until playback and audio have
been validated; only then decide whether what remains is a design problem or a motion problem.

## Not a benchmark yet

It carries no tag. It needs a person's judgement on all three dimensions first; see `docs/BENCHMARKS.md`.
