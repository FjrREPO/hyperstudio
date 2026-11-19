# Other agents

The server follows the MCP specification through the official SDK and uses nothing client-specific, so any
MCP client should be able to use it. **None of the clients on this page has been tested with HyperStudio.**
Clients differ in which MCP features they support; tools are the common denominator, and everything essential
here is a tool.

| Feature                       | Used for                        | If a client lacks it                                                         |
| ----------------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| Tools                         | Everything                      | Nothing works                                                                |
| Server instructions           | The order of work and the rules | The agent must be told; point it at `get_project` and the guides             |
| Resources                     | The IR schema and the guides    | Give the agent `docs/IR-SPECIFICATION.md` and the director skill another way |
| Prompts                       | Ready-made requests             | Type the request yourself                                                    |
| Image content in tool results | `review_video`'s contact sheets | The reply also lists the image paths                                         |

## Configuration

Most clients take the same shape as Claude Code's:

```json
{
  "mcpServers": {
    "hyperstudio": {
      "command": "node",
      "args": ["/path/to/hyperstudio/packages/mcp/src/server.ts", "--workspace", "/path/to/films"]
    }
  }
}
```

- **Cursor**: `.cursor/mcp.json` in the project, or the global one.
- **VS Code** agent mode: `.vscode/mcp.json` (its key is `servers`, with `"type": "stdio"`).
- **OpenCode**: its `mcp` configuration block.
- **LangGraph, CrewAI, the AI SDK and other frameworks**: use their MCP client adapter against the STDIO
  command above or the HTTP endpoint; or skip MCP and call the [REST API](REST-API.md) or the [SDK](SDK.md).

Check each client's own documentation for the exact file and keys; they change.

## If you test one

Run `list_projects`, `validate_video`, `review_video` (does the client show the images?) and a render with
`get_job_status`. Report what worked.
