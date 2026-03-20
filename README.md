# @agent-score/mcp

[![npm version](https://img.shields.io/npm/v/@agent-score/mcp.svg)](https://www.npmjs.com/package/@agent-score/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Model Context Protocol](https://modelcontextprotocol.io) server for [AgentScore](https://agentscore.sh) — trust and reputation tools for AI agent wallets in the [x402](https://github.com/coinbase/x402) payment ecosystem and [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) agent registry.

## Tools

| Tool | Tier | Description |
|------|------|-------------|
| `check_wallet_reputation` | Free | Cached trust reputation lookup |
| `assess_wallet` | Paid | On-the-fly assessment with allow/deny decision |
| `browse_agents` | Free | Browse registered ERC-8004 agents |
| `get_ecosystem_stats` | Free | Ecosystem-level statistics |

## Setup

Get an API key at [agentscore.sh/sign-up](https://agentscore.sh/sign-up).

### Claude Code

```bash
claude mcp add agentscore -e AGENTSCORE_API_KEY=ask_... -- npx -y @agent-score/mcp
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "agentscore": {
      "command": "npx",
      "args": ["-y", "@agent-score/mcp"],
      "env": {
        "AGENTSCORE_API_KEY": "ask_..."
      }
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentscore": {
      "command": "npx",
      "args": ["-y", "@agent-score/mcp"],
      "env": {
        "AGENTSCORE_API_KEY": "ask_..."
      }
    }
  }
}
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENTSCORE_API_KEY` | **Yes** | — | API key from [agentscore.sh](https://agentscore.sh) |
| `AGENTSCORE_BASE_URL` | No | `https://api.agentscore.sh` | API base URL override |

## Documentation

- [API Reference](https://docs.agentscore.sh)
- [MCP Specification](https://modelcontextprotocol.io)
- [ERC-8004 Standard](https://eips.ethereum.org/EIPS/eip-8004)
- [x402 Protocol](https://github.com/coinbase/x402)

## License

[MIT](LICENSE)
