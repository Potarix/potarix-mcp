import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: {
    ...process.env,
    POTARIX_API_KEY: process.env.POTARIX_API_KEY || "ptk_test_smoke_only"
  }
});

const client = new Client({
  name: "potarix-mcp-smoke",
  version: "0.1.0"
});

await client.connect(transport);
const tools = await client.listTools();
console.log(JSON.stringify({
  count: tools.tools.length,
  tools: tools.tools.map((tool) => tool.name).sort()
}, null, 2));
await client.close();
