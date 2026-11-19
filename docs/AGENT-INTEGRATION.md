# Agent integration

HyperStudio is built to be driven by an AI agent as well as by a person. There is one engine and four ways in;
all four call the same code, so a film made through any of them is made the same way.

```
 Claude Code · Codex · Cursor · any MCP client        your app or script          a person
              │                                          │        │                  │
          MCP server                                  REST API   SDK                CLI
        (@hyperstudio/mcp)                       (@hyperstudio/api) (@hyperstudio/sdk)
              └──────────────────────┬───────────────────┴────────┴──────────────────┘
                                     ▼
                           @hyperstudio/studio          projects · compile · review · renders · assets · audio
                                     ▼
                          HyperFrames + FFmpeg
```

| Interface          | Use it when                                                                     | Guide                          |
| ------------------ | ------------------------------------------------------------------------------- | ------------------------------ |
| **MCP server**     | An agent should make films by itself                                            | [MCP-SERVER.md](MCP-SERVER.md) |
| **REST API**       | Another program talks to HyperStudio over HTTP                                  | [REST-API.md](REST-API.md)     |
| **TypeScript SDK** | Your own code, in process or against the API                                    | [SDK.md](SDK.md)               |
| **CLI**            | A person, or an agent with a shell                                              | [COMPILER.md](COMPILER.md)     |
| **Skills**         | The agent needs to know _how_ to make a good film, not just which buttons exist | `skills/`                      |

Tools give an agent the ability; skills give it the judgement. The MCP server serves the director skill as a
resource (`hyperstudio://guide/direction`) and tells every client to read it first, so an agent that cannot
install skills still gets the method.

## What an agent can do

Create a project, save and validate a Creative IR, list and inspect recipes, compile, review real frames
(the contact sheets come back as images), start and track a render, inspect the result, search and download
free licensed media, and generate a voiceover. Storyboarding is not a tool: the agent does the thinking, and
HyperStudio checks the result.

## Local and remote

|           | Local                                    | Remote                                                  |
| --------- | ---------------------------------------- | ------------------------------------------------------- |
| MCP       | STDIO: `node packages/mcp/src/server.ts` | Streamable HTTP: `--http <port>`, bearer token required |
| API       | In process, through the SDK              | `node packages/api/src/server.ts`, API key required     |
| Rendering | On the machine running the server        | The same: wherever the server runs                      |
| Files     | A workspace folder                       | The same folder on the server                           |

There is no HyperStudio cloud. "Remote" means you run the server somewhere and connect to it.

## Verified, and not

Run on 2026-11-19:

| Client                                        | Result                                                                                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Official MCP SDK client over STDIO            | 7 tests: tools, resources, prompts, a full inspect/validate/compile, error handling, path safety                                              |
| Official MCP SDK client over HTTP             | Refuses to start without a token; 401 without it; tools work with it                                                                          |
| **Claude Code** (`claude -p`, real MCP calls) | Listed projects, validated, compiled; then compiled, rendered, polled the job and inspected a 15 s render                                     |
| **TypeScript SDK → REST API**                 | Created a project, saved an IR, compiled, rendered through a background job and verified the file                                             |
| **Codex CLI**                                 | **Not verified.** The login on the test machine had expired. The configuration in [CODEX.md](CODEX.md) is the documented form and is untested |
| Cursor, OpenCode, VS Code, LangGraph, CrewAI  | **Not tested.** See [OTHER-AGENTS.md](OTHER-AGENTS.md)                                                                                        |

## Security

Summarised in [SECURITY.md](SECURITY.md): a workspace boundary no tool can leave, no shell or arbitrary file
tool, tokens required for anything over HTTP, and no paid generation without the person's explicit yes.
