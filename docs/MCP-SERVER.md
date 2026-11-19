# MCP server

`@hyperstudio/mcp` exposes HyperStudio through the [Model Context Protocol](https://modelcontextprotocol.io),
using the official TypeScript SDK. Every tool is one call into `@hyperstudio/studio`.

```bash
node packages/mcp/src/server.ts --workspace <dir>              # STDIO, for an agent on this machine
HYPERSTUDIO_MCP_TOKEN=<16+ chars> node packages/mcp/src/server.ts --http 3900 --workspace <dir>
```

The **workspace** is a folder with one sub-folder per project (each holding `video.json`). It comes from
`--workspace`, then `HYPERSTUDIO_WORKSPACE`, then the directory the server is started in.

## Tools

| Tool                                                          | Does                                                                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `list_projects`, `create_project`, `get_project`              | Projects in the workspace; a project's IR, plan, files and renders                                   |
| `save_ir`                                                     | Replace a project's Creative IR and validate it. Problems come back with their path into the IR      |
| `list_recipes`, `inspect_recipe`                              | The shot recipes and one recipe's variables                                                          |
| `validate_video`                                              | Plan and problems, writing nothing                                                                   |
| `compile_video`                                               | Write the HyperFrames project; lists placeholders, warnings and credits owed                         |
| `review_video`                                                | Compile, run `hyperframes check`, take two frames per shot. **Returns the contact sheets as images** |
| `render_video`                                                | Start a background render; returns a job id                                                          |
| `get_job_status`, `cancel_job`                                | Track or stop a job                                                                                  |
| `inspect_render`                                              | The file's real length and whether it matches the plan                                               |
| `search_assets`, `download_asset`, `list_project_assets`      | Free licensed media, gated by licence, with credits owed                                             |
| `list_audio_providers`, `generate_voiceover`, `inspect_audio` | Voiceover; ElevenLabs only when keyed, and never past a paid plan's confirmation                     |

There is deliberately no `generate_storyboard`: writing the direction and the shots is the agent's job, and
`save_ir` and `review_video` check it. There is no shell tool and no general file tool.

Errors are returned as tool results with `isError`, in words the agent can act on.

## Resources

| URI                                                             | Content                                   |
| --------------------------------------------------------------- | ----------------------------------------- |
| `hyperstudio://ir-schema`                                       | JSON Schema of the Creative IR            |
| `hyperstudio://recipes`                                         | Every recipe with its variables           |
| `hyperstudio://guide/direction`                                 | How to direct a film (the director skill) |
| `hyperstudio://guide/ir`, `/recipes`                            | The IR specification and the recipe guide |
| `hyperstudio://guide/asset-licensing`, `/audio`, `/audio-costs` | Licensing and cost rules                  |

## Prompts

`product-showcase`, `saas-launch-video`, `review-video-quality`, `localize-video`.

## Server instructions

Sent to every client on connect: the order of work (real product, direction, shots, `save_ir`,
`validate_video`, `review_video`, revise, `render_video`, `inspect_render`) and the rules (no invented metrics,
no stand-in for the product, a passing check is not a finished film, no cost confirmed without the person).

## HTTP mode

- Needs `HYPERSTUDIO_MCP_TOKEN` of at least 16 characters; the server refuses to start without it.
- Every request needs `Authorization: Bearer <token>`; anything else gets 401.
- Binds to `127.0.0.1` unless `--host` says otherwise. Put TLS in front of it before exposing it.
- Stateless: one server and transport per request.

## Limits

- `review_video` and voiceover run synchronously and can take a minute; only renders are background jobs.
- Progress notifications are not sent; poll `get_job_status`.
- One workspace per server process. There are no per-user projects: anyone with the token sees every project.
- Dubbing is not exposed as a tool (it is in the CLI).
