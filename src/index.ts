import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAssessWallet } from './tools/assess-wallet.js';
import { registerBrowseAgents } from './tools/browse-agents.js';
import { registerCheckWalletReputation } from './tools/check-wallet-reputation.js';
import { registerGetEcosystemStats } from './tools/get-ecosystem-stats.js';

const server = new McpServer({
  name: 'agentscore-mcp',
  version: '2.0.0',
});

registerCheckWalletReputation(server);
registerAssessWallet(server);
registerGetEcosystemStats(server);
registerBrowseAgents(server);

const transport = new StdioServerTransport();
await server.connect(transport);
