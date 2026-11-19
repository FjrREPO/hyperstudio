# Claude Code

## Local (STDIO)

A project-level `.mcp.json` is in this repository; it points the server at `examples/` as the workspace:

```json
{
  "mcpServers": {
    "hyperstudio": {
      "command": "node",
      "args": ["packages/mcp/src/server.ts", "--workspace", "examples"]
    }
  }
}
```

Open Claude Code in the repository, approve the server when asked, and check it with `/mcp`. To add it for
another folder of films:

```bash
claude mcp add hyperstudio -- node /path/to/hyperstudio/packages/mcp/src/server.ts --workspace /path/to/films
```

## Remote (HTTP)

```bash
HYPERSTUDIO_MCP_TOKEN=<token> node packages/mcp/src/server.ts --http 3900 --workspace <dir>
claude mcp add --transport http hyperstudio http://<host>:3900/mcp --header "Authorization: Bearer <token>"
```

## The skill

`pnpm skill:link` links `skills/hyperstudio-director` and `skills/hyperstudio-review` into `.claude/skills/`.
With a shell, Claude Code can also use the CLI directly; the skill covers both.

## Verified

On 2026-11-19, with `claude -p --mcp-config .mcp.json --strict-mcp-config`: Claude Code called `list_projects`,
`validate_video` and `compile_video` and reported the plan correctly; in a second run it compiled, started a
render, polled the job until done, and inspected the 15-second result. The HTTP form above was not tried with
Claude Code (it was tested with the official MCP client).
