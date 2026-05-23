#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPotarixTools } from "./tools.js";

const server = new McpServer({
  name: "potarix-enricher",
  version: "0.1.0"
});

registerPotarixTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
