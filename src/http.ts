import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer as createMcpServer } from "./index.js";
import { runWithApiKey } from "./potarix-api.js";

const MCP_PATH = process.env.POTARIX_MCP_PATH || "/mcp";

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(raw ? JSON.parse(raw) : undefined);
      } catch {
        reject(new Error("Request body is not valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function bearerFromHeaders(req: IncomingMessage): string | undefined {
  const header = req.headers["authorization"] || req.headers["Authorization" as never];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1].trim() : value.trim();
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

/**
 * Stateless Streamable HTTP handler. Each MCP request carries its own caller's
 * `ptk_live_` bearer token, so we create a fresh server + transport per request
 * (no shared session state) and pin the caller's key into the request-scoped
 * API-key store for the duration of dispatch.
 */
async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const apiKey = bearerFromHeaders(req);
  if (!apiKey) {
    sendJson(res, 401, {
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message:
          "Missing Authorization header. Send: Authorization: Bearer ptk_live_... (mint a key at https://enricher.potarix.com)."
      },
      id: null
    });
    return;
  }

  let body: unknown;
  try {
    body = await readBody(req);
  } catch (error) {
    sendJson(res, 400, {
      jsonrpc: "2.0",
      error: { code: -32700, message: (error as Error).message },
      id: null
    });
    return;
  }

  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    // Stateless: no session id, no per-session server state.
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    // DNS-rebinding protection: opt in via env (host allow-list) for deployments.
    enableDnsRebindingProtection: Boolean(process.env.POTARIX_MCP_ALLOWED_HOSTS),
    allowedHosts: (process.env.POTARIX_MCP_ALLOWED_HOSTS || "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean)
  });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  await server.connect(transport);
  await runWithApiKey(apiKey, () => transport.handleRequest(req, res, body));
}

export async function startHttpServer(): Promise<void> {
  const port = Number(process.env.PORT || process.env.POTARIX_MCP_PORT || 8080);
  const host = process.env.HOST || "127.0.0.1";

  const httpServer = createHttpServer((req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/health" || url.pathname === "/healthz") {
      sendJson(res, 200, { status: "ok", server: "potarix-enricher", transport: "streamable-http" });
      return;
    }

    if (url.pathname !== MCP_PATH) {
      sendJson(res, 404, {
        jsonrpc: "2.0",
        error: { code: -32601, message: `Not found. MCP endpoint is ${MCP_PATH}.` },
        id: null
      });
      return;
    }

    handleMcp(req, res).catch((error) => {
      if (!res.headersSent) {
        sendJson(res, 500, {
          jsonrpc: "2.0",
          error: { code: -32603, message: (error as Error).message },
          id: null
        });
      }
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));
  console.error(`Potarix MCP (Streamable HTTP) listening on http://${host}:${port}${MCP_PATH}`);
}
