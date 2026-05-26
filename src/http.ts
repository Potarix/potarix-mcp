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
  res.writeHead(status, { "Content-Type": "application/json", ...SECURITY_HEADERS });
  res.end(payload);
}

// This endpoint serves JSON-RPC, never HTML. Lock it so no browser can render
// the response as a document or frame it. The MCP App *view* CSP is declared
// separately on the ui:// resource via _meta.ui.csp (see src/ui.ts); the host
// enforces that on the sandboxed iframe. These headers are defense-in-depth
// for the transport surface.
const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  // nginx terminates TLS in front of this loopback service; HSTS is safe to assert.
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

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

  // Apply hardening headers to the streamed/SSE response path too (this path
  // bypasses sendJson). Safe to set before headers are flushed.
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);

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
