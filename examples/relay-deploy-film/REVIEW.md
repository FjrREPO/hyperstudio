# Review: Relay, the launch film (rebuilt as a deploy journey)

Written on 2026-11-19 from the rendered file `renders/relay-deploy-film.mp4`: a sheet at one frame a second.
This is an author's inspection of still frames and level meters. It is not a review of the film: nobody has
watched it at speed or listened to it. Relay is an example product; its three views, code, logs and figures
are invented, and its sounds are synthesised.

The first version (one dashboard, a camera circling it) was judged worse than Lumen and Marlow: "dashboard,
zoom, dashboard, zoom, terminal, logo". The cause was the plan, not the polish: one page cannot show a
journey. This version gives each milestone its own picture.

- 29.1 s, 1920×1080, 30 fps, five scenes. HyperFrames check: 0 errors, 1 warning (first frame)
- 11% of frames still; longest freeze 2.1 s, on the name at the end

## Timeline

| Time      | Milestone      | What is on screen                                                                |
| --------- | -------------- | -------------------------------------------------------------------------------- |
| 0.0-2.8   | The stakes     | Thirty machines on the previous release, traffic 0%; the camera settles square   |
| 2.8-4.8   | A line changes | Line 15 of `retry.ts`, large; the new code is typed; the margin turns green      |
| 4.8-8.2   | Pushed         | The editor and its terminal; `git push origin main`; "deploy started"            |
| 8.2-9.9   | Built          | A build log arriving line by line over a filling bar                             |
| 9.9-13.0  | Tested         | Six shards fill at different speeds; "412 passed"                                |
| 13.0-16.4 | Canary         | Three machines turn green; traffic counts to 10%; the health line starts         |
| 16.4-19.8 | Rolling out    | Twelve more turn one by one while traffic counts 10 to 50%; the line continues   |
| 19.8-24.3 | Live (payoff)  | Promote is clicked; the rest turn while traffic counts 50 to 100%; status "live" |
| 24.3-26.3 | Into one       | The camera pushes into a single green machine                                    |
| 26.1-29.1 | The name       | The machine dissolves into the mark; "Relay", "Ship in steps. Watch every one."  |

## Three dimensions

### 1. Visual and art direction: inspected from stills only

- Works: each milestone is a different picture; the fleet turning green reads at thumbnail size; the figure
  now counts through the rollout instead of jumping.
- Weak: the opening fleet is dark on dark. It is a hook only once the voice says what it is.
- Weak: at 4.8 to 9.9 s the terminal and the build log leave much of the frame empty.
- Weak: the closing card is still the stock ending recipe; the push into one machine joins it to the film.

### 2. Motion and editing: NOT validated

Stills cannot show timing or whether the cuts and the push into one machine feel right. Known from the plan:
three hard cuts and one dissolve; the rollout turns the fleet left once and returns square.

### 3. Audio and sound design: NOT validated

Eight lines from Kokoro (voice `am_fenrir`, picked by name), synthesised interface sounds, and a music bed:
"Lifelike (Dark Glitch Technology Background Music)" by Alexi Action, CC BY 3.0 (Wikimedia Commons, licence
read at the source), chosen by its title and licence, not by ear. Mean -21.1 dB, peak -1.0 dB, no silent gap.
Sync was placed from clip lengths and beat times. Credit is owed wherever the film is shown.

## The user's review of the previous render (2026-11-19, from its frame sequence)

Storytelling, art direction, composition and visual progression: good. Motion timing and sound: not judged
(no direct playback, not listened to). Brand ending: needs strengthening. Four notes, and what was done about each afterwards:

1. The opening is relevant but has no hook for someone who does not read code.
2. The testing section is repetitive: bars filling for several seconds with little variation.
3. The canary rollout is the best part but could be more dramatic: it should feel like a process under way,
   not a number and boxes increasing.
4. The ending is abrupt: from the 100% dashboard to the logo with no emotional payoff.

What was done, on the user's later instruction to finish everything: (1) the film now opens on the thirty
machines, with the line "Thirty machines run your product"; (2) the build and test scene is 1.4 s shorter and
the shards finish at different times; (3) machines turn one by one while the traffic figure counts 10, 50,
100 and the health line continues; (4) the camera pushes into one green machine, which dissolves into the mark.
None of this has been seen by the user.

Decision at the time: a benchmark candidate, not final.

## Not a benchmark yet

It carries no tag. It needs a person's judgement on all three dimensions first; see `docs/BENCHMARKS.md`.
