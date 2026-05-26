#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPotarixTools } from "./tools.js";
import { registerPotarixUiResources } from "./ui.js";
import { startHttpServer } from "./http.js";

export const SERVER_INFO = { name: "potarix-enricher", version: "0.1.0" } as const;

export function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: "Potarix Enricher tools resolve a company name to its website and find verified business emails: by person plus domain, by decision-maker role, from a LinkedIn URL, or as a whole-company roster, plus a one-call full enricher. Authenticate tool calls with a ptk_live_ key via the Authorization: Bearer header (mint one at https://enricher.potarix.com or POST /auth/signup); initialize and tools/list are open. Every result includes credits_remaining; whiffed and repeat lookups are free; on a 402 out-of-credits error, call topup_credits then retry. To try every tool free with no signup and no charge, authenticate with a sandbox key instead: Authorization: Bearer ptk_test_<anything>. Sandbox returns realistic placeholder data, never calls a provider, and never spends credits. Hosts that support MCP Apps render an interactive results card for find_all and a one-click top-up card for check_balance and topup_credits." });
  registerPotarixTools(server);
  registerPotarixUiResources(server);
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
