# Creative IR specification

The Creative IR is one JSON file that says what a film is: the direction it follows, what is real in it, and
its shots. It contains no HTML, CSS, GSAP or HyperFrames attributes. The schema is `packages/ir/src/index.ts`
(Zod); unknown keys are rejected at every level.

```json
{
  "project": { "title": "…", "fps": 30, "aspectRatio": "16:9", "duration": 15 },
  "direction": {
    "concept": "…",
    "audience": "…",
    "message": "…",
    "tone": "…",
    "palette": "…",
    "typography": "…",
    "motion": "…",
    "pacing": "…"
  },
  "brand": { "name": "…", "kind": "real" },
  "style": { "background": "#f3efe6", "ink": "#17150f", "accent": "#2747f0", "light": "soft" },
  "screens": {
    "home": { "src": "screens/home.png", "width": 1440, "height": 900, "origin": "captured", "regions": {} },
    "app": { "html": "product/index.html", "width": 1440, "height": 900, "origin": "captured" }
  },
  "scenes": [{ "id": "…", "recipe": "…", "duration": 2, "purpose": "…" }],
  "audio": [{ "id": "…", "src": "…" }]
}
```

## `project`

| Field         | Type                         | Default  | Notes                                                      |
| ------------- | ---------------------------- | -------- | ---------------------------------------------------------- |
| `title`       | string                       | required | Becomes the page title                                     |
| `fps`         | 24, 25, 30 or 60             | 30       |                                                            |
| `aspectRatio` | `16:9`, `9:16`, `1:1`, `4:5` | `16:9`   | 1920×1080, 1080×1920, 1080×1080, 1080×1350                 |
| `resolution`  | `{ width, height }`          | none     | Overrides `aspectRatio`                                    |
| `duration`    | seconds                      | none     | An assertion: compile fails unless the scenes add up to it |

## `direction` (required)

Eight decisions, each a full sentence (at least 12 characters; a keyword is rejected). They are written
before any scene and every scene follows them.

| Field        | What it decides                                                |
| ------------ | -------------------------------------------------------------- |
| `concept`    | The idea of the film                                           |
| `audience`   | Who it is for and what they already know                       |
| `message`    | The one thing the viewer should leave with                     |
| `tone`       | How it feels                                                   |
| `palette`    | Background, ink and the one accent, and what the accent is for |
| `typography` | Which faces, at what scale, for what                           |
| `motion`     | What moves, how, and what stays still                          |
| `pacing`     | Shot length and where the film breathes                        |

The compiler cannot judge these. It requires them, writes them into the project's `STORYBOARD.md`, and the
review step checks the frames against them.

## `brand` (required)

| Field  | Type                | Notes                                                   |
| ------ | ------------------- | ------------------------------------------------------- |
| `name` | string              |                                                         |
| `kind` | `real` or `example` | `example` is reported as a placeholder by every compile |
| `url`  | string              | Optional                                                |

## `style`

The film's visual system, set once: a map of variable id to value. It reaches every scene whose recipe
declares that id. The shared ids are `background`, `ink`, `accent`, `displayFont` and `textFont`. Three keys are
read by the compiler itself for the stage that sits behind every scene: `background` (hex colour), `light`
(`none`, `soft` or `aurora`) and `glow` (hex colour, optional).

| `light`  | The stage                                                                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `none`   | The flat background colour                                                                                                                                                                               |
| `soft`   | One pale light that moves once across the film. For light, calm films                                                                                                                                    |
| `aurora` | Three large glows that drift once across the film, under a vignette and fine grain. The glows take the film's `accent`, and `glow` as a second hue. For a stage with depth, usually on a dark background |

A scene **cannot** set these variables. A key no recipe in the film declares is an error.

## `screens`

Screenshots of the product, keyed by a name scenes refer to.

| Field             | Type                                  | Notes                                                       |
| ----------------- | ------------------------------------- | ----------------------------------------------------------- |
| `src`             | path                                  | Relative to the IR file                                     |
| `width`, `height` | integers                              | Size in CSS pixels (the file may be 2× or 3× that)          |
| `origin`          | `captured`, `supplied`, `placeholder` | Where it came from. `placeholder` is reported               |
| `regions`         | `{ name: [x, y, width, height] }`     | Components a shot can frame, point at, outline or type into |

A region must lie inside the screen.

### Live screens

A screen can instead be the product's own page, mounted in the shot and driven, so the interface changes
state on camera instead of being cut between screenshots. Give `html` in place of `src` and leave `regions`
out:

```json
"screens": { "app": { "html": "product/index.html", "width": 1440, "height": 900, "origin": "captured" } }
```

The page is one self-contained HTML file:

- Everything is inside one element with `class="app"`, sized `width` × `height`.
- What is shown depends only on that element's `data-state`. List the states in `data-states="home answer"`.
- Components a shot uses carry `data-region="name"`. They are measured in the state they are used in.
- Parts that should arrive one by one carry `data-reveal`; chart lines to be drawn carry `data-draw`, and what
  appears once they are drawn carries `data-fade`.
- Scripts and comments are dropped. The page's custom properties are renamed on the way in, so a film's
  colours never repaint the product.

Only recipes that drive an interface (`product-take`) accept a live screen.

## `scenes[]`

| Field        | Type                                        | Default  | Notes                                                                          |
| ------------ | ------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| `id`         | lowercase id                                | required | Unique. `main`, `root` and `hs-*` are reserved                                 |
| `recipe`     | recipe name                                 | required | See `hyperstudio recipes`                                                      |
| `duration`   | seconds                                     | required | Whole frames; within the recipe's range                                        |
| `purpose`    | sentence                                    | required | What the scene tells the viewer and why it is there                            |
| `screen`     | screen name                                 | none     | Required by recipes that show a screen, refused by the others                  |
| `assets`     | `{ id: path }` or `{ id: { src, origin } }` | `{}`     | Image variables                                                                |
| `text`       | `{ id: string }`                            | `{}`     | String variables (copy)                                                        |
| `params`     | `{ id: string, number or boolean }`         | `{}`     | Everything else, including region names                                        |
| `sources`    | strings                                     | `[]`     | Where each figure shown comes from. Required when the recipe shows a statistic |
| `transition` | `{ type, duration }`                        | cut      | How this scene is entered: `cut`, `fade`, `crossfade`                          |

A variable may be set in only one of `assets`, `text`, `params`.

### `transition`

| `type`      | Effect                                                           | Timing                            |
| ----------- | ---------------------------------------------------------------- | --------------------------------- |
| `cut`       | Hard cut                                                         | None                              |
| `fade`      | Dip through the stage colour, half before the cut and half after | None                              |
| `crossfade` | The scene fades in over the end of the previous one              | The film is shorter by `duration` |

`duration` defaults to 0.6 s and must be shorter than both scenes it joins. The first scene cannot crossfade,
and fading into it is warned about (frame 0 would be empty).

### `beats` (takes of a live interface)

A scene whose recipe drives a live screen lists what happens in it, in order. Times count from the scene's
start.

```json
"beats": [
  { "at": 0.1, "do": "camera", "target": "ask-bar", "fill": 0.6, "over": 1.2 },
  { "at": 0.8, "do": "type", "target": "ask-input", "text": "Which plan grew fastest?", "over": 1.5 },
  { "at": 2.6, "do": "click", "target": "send", "state": "thinking" },
  { "at": 3.6, "do": "state", "state": "answer" },
  { "at": 3.6, "do": "reveal", "target": "answer", "over": 1.0 },
  { "at": 4.0, "do": "draw", "target": "plot" }
]
```

| `do`        | What happens                                                                | Uses                             |
| ----------- | --------------------------------------------------------------------------- | -------------------------------- |
| `camera`    | The camera moves to frame a region, starting at `at`                        | `target`, `fill`, `over`, `ease` |
| `cursor`    | The pointer arrives at a region at `at`                                     | `target`, `over` (travel time)   |
| `click`     | As `cursor`, then a click; with `state`, the interface switches as it lands | `target`, `state`, `over`        |
| `type`      | Text is typed into an input                                                 | `target`, `text`, `over`         |
| `state`     | The interface switches state                                                | `state`                          |
| `reveal`    | The region's `data-reveal` parts arrive one by one                          | `target`, `over`                 |
| `draw`      | The region's `data-draw` lines are drawn                                    | `target`, `over`                 |
| `highlight` | The region is outlined; with `over`, the outline leaves after that long     | `target`, `over`                 |

The compiler rejects a target or state the page does not have, and warns when nothing starts for more than
1.5 s: an interface that sits untouched reads as a frozen picture.

## `audio[]`

| Field               | Type                                  | Default    | Notes                                                     |
| ------------------- | ------------------------------------- | ---------- | --------------------------------------------------------- |
| `id`                | lowercase id                          | required   | Unique across scenes and audio                            |
| `src`               | path                                  | required   |                                                           |
| `origin`            | `captured`, `supplied`, `placeholder` | `supplied` | Use `placeholder` for a draft voice                       |
| `role`              | `voice`, `music`, `sfx`               | `music`    | Two voice clips may not overlap                           |
| `scene`             | scene id                              | none       | `start` then counts from that scene's start               |
| `start`             | seconds                               | 0          | From the film's start, or the scene's when `scene` is set |
| `duration`          | seconds                               | to the end | Must not run past the end                                 |
| `volume`            | 0 to 3.98                             | 1          | 1 = 0 dB                                                  |
| `fadeIn`, `fadeOut` | seconds                               | 0          |                                                           |

## What the compiler enforces

Errors (the IR is rejected):

- a brand variable set on a scene instead of in `style`;
- a shot that frames the same thing the same way as the shot before it (same recipe, screen, regions, layout);
- copy longer than its recipe sets it in;
- a statistic without `sources`;
- a region name that is not on the scene's screen; a recipe given or denied a screen wrongly;
- a duration that does not land on a whole frame, or scenes that do not add up to `project.duration`;
- unknown recipes, variables, options, files.

Warnings (compiled, but listed):

- an average shot longer than 3.5 s;
- a fade into the first scene;
- a screen no scene shows.

Reported every time: every placeholder (an example brand, placeholder screens, assets and audio).

## Not in the IR

Per-element keyframes, free positioning, more than one recipe in a scene, captions and voice generation.
Those belong to a recipe or to HyperFrames. The IR is a plan, not a visual programming language.
