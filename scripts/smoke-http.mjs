import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Verifies the Streamable HTTP transport end to end against an already-running
// server. Usage:
//   node dist/index.js --http   # in one shell (set PORT if you like)
//   POTARIX_MCP_URL=http://127.0.0.1:8080/mcp \
//   POTARIX_API_KEY=ptk_live_... node scripts/smoke-http.mjs
const url = process.env.POTARIX_MCP_URL || "http://127.0.0.1:8080/mcp";
const apiKey = process.env.POTARIX_API_KEY || "ptk_test_smoke_only";

const transport = new StreamableHTTPClientTransport(new URL(url), {
  requestInit: {
    headers: { Authorization: `Bearer ${apiKey}` }
  }
});

const client = new Client({ name: "potarix-mcp-http-smoke", version: "0.1.0" });
await client.connect(transport);

const tools = await client.listTools();
const out = {
  transport: "streamable-http",
  url,
  count: tools.tools.length,
  tools: tools.tools.map((t) => t.name).sort()
};

// Optional live tool call when a real key is supplied.
if (process.env.POTARIX_SMOKE_CALL === "1") {
  try {
    const result = await client.callTool({
      name: "lookup_company_website",
      arguments: { company_name: process.env.POTARIX_SMOKE_COMPANY || "Stripe" }
    });
    out.toolCall = { name: "lookup_company_website", result };
  } catch (error) {
    out.toolCallError = String(error);
  }
}

console.log(JSON.stringify(out, null, 2));
await client.close();
