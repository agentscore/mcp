# @agentscore/mcp

MCP server for AgentScore trust and reputation tools. ESM-only.

## Architecture

Single-package TypeScript library published to npm.

| File | Purpose |
|------|---------|
| `src/` | Source code |
| `src/tools/` | MCP tool definitions |
| `tests/` | Vitest tests |
| `dist/` | Build output (tsup) |

### Tools

| Tool | Tier | Description |
|------|------|-------------|
| `check_wallet_reputation` | Free | Cached trust reputation lookup |
| `assess_wallet` | Paid | On-the-fly assessment with allow/deny decision |
| `browse_agents` | Free | Browse registered ERC-8004 agents |
| `get_ecosystem_stats` | Free | Ecosystem-level statistics |

## Tooling

- **Bun** — package manager. Use `bun install`, `bun run <script>`.
- **ESLint 9** — linting. `bun run lint`.
- **tsup** — builds CJS + ESM. `bun run build`.
- **Vitest** — tests. `bun run test`.
- **Lefthook** — git hooks. Pre-commit: lint. Pre-push: typecheck.

## Key Commands

```bash
bun install
bun run lint
bun run typecheck
bun run test
bun run build
```

## Workflow

1. Create a branch
2. Make changes
3. Lefthook runs lint on commit, typecheck on push
4. Open a PR — CI runs automatically
5. Merge (squash)

## Rules

- **No silent refactors**
- **Never commit .env files or secrets**
- **Use PRs** — never push directly to main
