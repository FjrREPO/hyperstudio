# Review: Lumen, the 30-second launch film (polish pass)

Answered on 2026-11-19 from the rendered file `renders/saas-product-showcase-30s.mp4`: a sheet at one frame a
second, four full frames including frame 0, and the motion strips with their numbers. Sound was measured, not
heard. The narrative and the art direction are unchanged from the previous cut; this pass is precision.

- 30.2 s, 1920×1080, 30 fps. HyperFrames check: 0 errors, 0 warnings
- The take's own audit (safe area, type on top of the interface, camera cropping its subject): nothing reported.
  Before the fixes below it reported "An answer, not a dashboard." on top of the interface from 9.3 s
- Motion: 42% of frames still; longest freeze 1.7 s at 8.1 s
- Sound: interface effects only; no music, no narration
- Placeholders: the brand (Lumen is an example product), both interfaces, the sound effects

## Before and after

| Time      | Before                                                                               | After                                                                                             |
| --------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 0.0       | The headline was half risen out of its mask at frame 0: cut letters                  | Whole at frame 0. Lines now fade as they rise, and leave by fading, so no frame shows cut letters |
| 0.0-3.3   | The export was small beside the headline                                             | A third larger, set low so it runs off the bottom of the frame under the headline                 |
| 3.3-7.4   | "Then you wait." at headline size crowded the thread                                 | One size down, with clear stage between it and the thread                                         |
| 15.0-18.6 | "An answer," touched the product's right edge                                        | The product is framed smaller on the left; the line has its own space                             |
| 18.6-19.9 | A tight close-up of the sidebar                                                      | The sidebar with the answer card beside it: the new board is seen in context                      |
| 19.9-24.2 | Three large reframings: sidebar, follow-up bar, second answer                        | Two: out to the whole app while the follow-up is typed, then in to the second answer              |
| 26.9-30.2 | The mark was cut on its left: the slow push moved the page but not the cover over it | The push moves both; the mark is whole. The move to it is slower and eased                        |

## What now checks itself

Each take steps through its own timeline once and reports, as warnings in `hyperframes check`: a line of the
film outside the safe area, a line on top of the interface, and a camera move that leaves part of its subject
outside the frame. Generated scenes are also folded onto fewer lines, so they stay under HyperFrames' size
check.

## Rubric

|               | Verdict           | Evidence                                                                              |
| ------------- | ----------------- | ------------------------------------------------------------------------------------- |
| Storytelling  | Pass              | Unchanged                                                                             |
| Art direction | Pass              | Unchanged                                                                             |
| Typography    | Pass              | No cut letters at any sampled frame; five headlines, none touching the interface      |
| Composition   | Pass, with a note | The audit is clean. The pull-back product under "Ask. Answer. Decide." is still small |
| Motion        | Pass, with a note | 42% still frames, higher than before: the slow push no longer moves the type          |
| Transitions   | Pass              | One cut; the follow-up section has one fewer reframing                                |
| Brand         | Pass, with a note | The mark is whole and floats on the stage; the last two seconds are close to still    |
| Sound         | Revise            | Sparse synthesised effects only                                                       |
| Assets        | Revise to publish | Example product and interfaces                                                        |

## Remaining weaknesses

1. Sound: no music, no voice.
2. The product is an example written for the film.
3. Still frames went up, not down. The film holds still while text is typed and after the mark lands.
4. The audit measures boxes, not taste: it cannot tell a tight composition from a good one.
5. Easing and rhythm at full speed were not judged; that needs a person watching the file.
