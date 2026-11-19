# Creative IR specification

The Creative IR is one JSON file that says what the video is. It names recipes and gives them values; it
contains no HTML, CSS, GSAP or HyperFrames attributes. The schema is `packages/ir/src/index.ts` (Zod);
unknown keys are rejected at every level.

## Shape

```json
{
  "project": { "title": "…", "fps": 30, "aspectRatio": "16:9", "duration": 16.2 },
  "style": { "accent": "#c9a35c" },
  "scenes": [{ "id": "…", "recipe": "…", "duration": 6 }],
  "audio": [{ "id": "…", "src": "…" }]
}
```

## `project`

| Field         | Type                               | Default  | Notes                                                      |
| ------------- | ---------------------------------- | -------- | ---------------------------------------------------------- |
| `title`       | string                             | required | Becomes the page title                                     |
| `fps`         | 24 \| 25 \| 30 \| 60               | 30       |                                                            |
| `aspectRatio` | `16:9` \| `9:16` \| `1:1` \| `4:5` | `16:9`   | 1920×1080, 1080×1920, 1080×1080, 1080×1350                 |
| `resolution`  | `{ width, height }`                | —        | Overrides `aspectRatio`                                    |
| `duration`    | seconds                            | —        | An assertion: compile fails unless the scenes add up to it |

## `style`

A map of recipe variable id → value, applied to every scene whose recipe declares that id. A scene's own value
wins. A key that no recipe in the project declares is an error. Image variables cannot be set here.

## `scenes[]`

| Field        | Type                                          | Default  | Notes                                                         |
| ------------ | --------------------------------------------- | -------- | ------------------------------------------------------------- |
| `id`         | lowercase id (`a-z`, digits, `-`)             | required | Unique. `main`, `root` and `hs-*` are reserved                |
| `recipe`     | recipe name                                   | required | See `hyperstudio recipes`                                     |
| `duration`   | seconds                                       | required | Whole frames; within the recipe's `minDuration`–`maxDuration` |
| `assets`     | `{ variableId: path }`                        | `{}`     | Image variables. Paths are relative to the IR file            |
| `text`       | `{ variableId: string }`                      | `{}`     | String variables (copy)                                       |
| `params`     | `{ variableId: string \| number \| boolean }` | `{}`     | Every other variable                                          |
| `transition` | `{ type, duration }`                          | cut      | How this scene is entered                                     |

A variable may be set in only one of `assets`, `text`, `params`. Values are checked against the recipe's
declaration: enum options, number `min`/`max`, hex colours, booleans.

### `transition`

| `type`      | Effect                                                                                        | Timing                                                                |
| ----------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `cut`       | Hard cut                                                                                      | None                                                                  |
| `fade`      | Dip through black, half before the cut and half after. On the first scene: fade in from black | None                                                                  |
| `crossfade` | The scene fades in over the end of the previous one                                           | Scene starts `duration` earlier, so the film is shorter by `duration` |

`duration` defaults to 0.6 s and must be shorter than both scenes it joins. The first scene cannot crossfade.

## `audio[]`

| Field               | Type         | Default                 | Notes                                 |
| ------------------- | ------------ | ----------------------- | ------------------------------------- |
| `id`                | lowercase id | required                | Unique across scenes and audio        |
| `src`               | path         | required                | Relative to the IR file               |
| `start`             | seconds      | 0                       |                                       |
| `duration`          | seconds      | to the end of the video | Must not run past the end             |
| `volume`            | 0–3.98       | 1                       | 1 = 0 dB (HyperFrames' `data-volume`) |
| `fadeIn`, `fadeOut` | seconds      | 0                       |                                       |

## Timing rules

- Time is in seconds. Every duration, start and transition must be a whole number of frames at `fps`;
  the error names the nearest valid value.
- Scenes play in array order, back to back. Only a crossfade overlaps.
- Total length = the end of the last scene.

## Not in the IR

Per-element keyframes, free positioning, several recipes in one scene, captions, and voiceover generation.
Those are either a recipe's job or HyperFrames' (see its skills). The IR is a plan, not a visual programming
language.
