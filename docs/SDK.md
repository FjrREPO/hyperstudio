# TypeScript SDK

`@hyperstudio/sdk` gives the same methods against the engine in your process or against a HyperStudio API.

```ts
import { HyperStudio } from "@hyperstudio/sdk";

const studio = new HyperStudio({ workspace: "./films" }); // local: no server, no key
// const studio = new HyperStudio({ baseUrl: "http://127.0.0.1:3901", apiKey }); // remote

await studio.projects.create("launch");
const plan = await studio.projects.saveIr("launch", ir);
if (!plan.ok) {
  for (const problem of plan.errors) console.log(problem.path, problem.message);
} else {
  await studio.compile("launch");
  const review = await studio.review("launch"); // check findings and contact sheet paths
  const job = await studio.renders.start("launch", { quality: "looks", idempotencyKey: "launch-v1" });
  const done = await studio.renders.wait(job.id);
  const file = await studio.renders.inspect("launch"); // { seconds, plannedSeconds, matchesPlan, … }
}
```

|                                                    |                                              |
| -------------------------------------------------- | -------------------------------------------- |
| `projects.list / create / get / saveIr`            | Projects and their IR                        |
| `recipes.list / get`                               | Recipes and their variables                  |
| `validate`, `compile`, `review`                    | The three steps before a render              |
| `renders.start / status / wait / cancel / inspect` | Background render jobs and the finished file |
| `assets.search / list`                             | Free licensed media and a project's assets   |

A rejected IR comes back as `{ ok: false, errors }`; it is not thrown. Other failures from a remote API throw
`HyperStudioError` with `status` and `code`.

The SDK does not generate storyboards or call a language model. It is the engine; the thinking is the caller's.
It is consumed as TypeScript source from this repository and is not published to npm.

Voiceover, asset download and webhook verification are not in the SDK yet (there are no webhooks to verify).
