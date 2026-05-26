#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPotarixTools } from "./tools.js";
import { startHttpServer } from "./http.js";

export const SERVER_INFO = { name: "potarix-enricher", version: "0.1.0" } as const;

export function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO);
  registerPotarixTools(server);
  return server;
}

function wantsHttp(): boolean {
  const transport = (process.env.POTARIX_MCP_TRANSPORT || "").toLowerCase();
  if (transport === "http" || transport === "streamable-http") return true;
  if (transport === "stdio") return false;
  return process.argv.includes("--http");
}

async function main(): Promise<void> {
  if (wantsHttp()) {
    await startHttpServer();
    return;
  }
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
