# Security of the agent interfaces

What the MCP server, the REST API and the SDK will and will not let a caller do. To report a vulnerability,
see the repository's [security policy](../SECURITY.md).

| Boundary                             | How it is kept                                                                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The workspace**                    | Every project name must match `^[a-z][a-z0-9-]{0,62}$`, and every file path a caller gives is resolved inside its project and refused if it leaves. Covered by tests with `../`, absolute paths and odd names                                     |
| **No shell, no general file access** | There is no tool that runs a command or reads or writes an arbitrary path. Tools call fixed functions                                                                                                                                             |
| **What does run**                    | `npx hyperframes` (check, snapshot, render), `ffprobe`, `ffmpeg` and, on macOS, `say`, each with fixed arguments. Project names are validated before they reach a command line, and nothing is run through a shell                                |
| **Remote access**                    | MCP over HTTP needs `HYPERSTUDIO_MCP_TOKEN`; the REST API needs `HYPERSTUDIO_API_KEY`. Both refuse to start without one of at least 16 characters, compare it in constant time, and bind to `127.0.0.1` by default                                |
| **Credentials**                      | Provider keys are read from the environment and sent only in request headers. They are not written to the IR, to compiled projects, to caches or to logs; keys in query strings are redacted before logging. A compiled film never contains a key |
| **Spending**                         | Paid audio needs the person's explicit confirmation (`--confirm-cost`, or `userConfirmedCost` over MCP, which the tool description forbids the agent to set alone). The Free plan is never exceeded and no plan is ever upgraded                  |
| **Limits**                           | REST: 120 requests a minute, 1 MB bodies. Renders are background jobs that can be cancelled                                                                                                                                                       |
| **Licences**                         | Only assets whose own licence allows commercial use and editing are returned or downloaded without a person's review                                                                                                                              |

## What is not protected

- **One workspace, one token.** There are no users: anyone holding the token can read and change every project
  in that workspace. Do not share a server between people who should not see each other's work.
- **No TLS.** Put a reverse proxy with TLS in front before exposing either server beyond the machine.
- **Recipes and compiled films are code.** A recipe is HTML and JavaScript that runs in Chrome when a film is
  checked or rendered. Use recipes you have read.
- **Render load.** A render uses Chrome and FFmpeg at full tilt. Nothing caps how many are started; the rate
  limit is the only brake.
- **The agent's own judgement.** `userConfirmedCost` is a promise the agent makes. A client that auto-approves
  tool calls weakens it; keep paid tools on manual approval.
