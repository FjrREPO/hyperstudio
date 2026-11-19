# Codex

**Not verified.** The Codex login on the test machine had expired, so no tool call was made through Codex.
What follows is the documented configuration; treat it as untested.

```bash
codex mcp add hyperstudio -- node /path/to/hyperstudio/packages/mcp/src/server.ts --workspace /path/to/films
codex mcp list
```

Or in `~/.codex/config.toml`:

```toml
[mcp_servers.hyperstudio]
command = "node"
args = ["/path/to/hyperstudio/packages/mcp/src/server.ts", "--workspace", "/path/to/films"]
```

For a single run without changing the configuration:

```bash
codex exec \
  -c 'mcp_servers.hyperstudio.command="node"' \
  -c 'mcp_servers.hyperstudio.args=["/path/to/hyperstudio/packages/mcp/src/server.ts","--workspace","/path/to/films"]' \
  "Use the hyperstudio tools to list the projects and validate one."
```

Use absolute paths: Codex starts the server from its own working directory.

To verify: after `codex login`, run the `codex exec` line above; it should name the projects in the workspace.
