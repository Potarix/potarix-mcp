import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

/**
 * MCP Apps UI (io.modelcontextprotocol/ui) for the Potarix Enricher.
 *
 * Two self-contained interactive cards rendered in the host's sandboxed iframe:
 *   - find_all results card: company + decision-makers + email roster as a table,
 *     with an inline "top up" prompt when the balance runs low.
 *   - balance / top-up card: shows credits and one-click top-up buttons that call
 *     the topup_credits / start_checkout tools back through the host.
 *
 * Each card is a single HTML string with inline CSS + vanilla JS implementing the
 * SEP-1865 postMessage protocol directly (ui/initialize handshake, the
 * ui/notifications/tool-result push, and tools/call back to the host), so the
 * cards stay dependency-free and need no bundler.
 */

export const FIND_ALL_CARD_URI = "ui://potarix/find-all.html";
export const TOPUP_CARD_URI = "ui://potarix/topup.html";

// Shared bridge: JSON-RPC 2.0 over postMessage to the MCP host.
const BRIDGE = `
const PROTOCOL_VERSION = "2026-01-26";
let _rpcId = 1;
const _pending = {};
function _send(msg) { window.parent.postMessage(Object.assign({ jsonrpc: "2.0" }, msg), "*"); }
function _request(method, params) {
  return new Promise((resolve, reject) => {
    const id = _rpcId++;
    _pending[id] = { resolve, reject };
    _send({ id, method, params });
  });
}
function callTool(name, args) { return _request("tools/call", { name, arguments: args || {} }); }
function reportSize() {
  try { _send({ method: "ui/notifications/size-changed", params: { height: document.body.scrollHeight } }); } catch (e) {}
}
window.addEventListener("message", (event) => {
  const m = event.data;
  if (!m || m.jsonrpc !== "2.0") return;
  if (m.id !== undefined && (m.result !== undefined || m.error !== undefined)) {
    const p = _pending[m.id];
    if (p) { delete _pending[m.id]; m.error ? p.reject(m.error) : p.resolve(m.result); }
    return;
  }
  if (m.method === "ui/notifications/tool-result") { try { render(m.params); } catch (e) {} reportSize(); }
});
async function _init() {
  try {
    await _request("ui/initialize", {
      capabilities: {},
      clientInfo: { name: "potarix-enricher-ui", version: "1.0.0" },
      protocolVersion: PROTOCOL_VERSION,
    });
    _send({ method: "ui/notifications/initialized", params: {} });
  } catch (e) {}
  reportSize();
}
function resultJson(params) {
  const item = (params && params.content || []).find((c) => c.type === "text");
  if (!item) return null;
  try { return JSON.parse(item.text); } catch (e) { return null; }
}
_init();
`;

const BASE_STYLE = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { margin: 0; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; background: #fff; }
@media (prefers-color-scheme: dark) { body { color: #e7e9ec; background: #15171b; } }
.wrap { padding: 14px 16px; max-width: 680px; }
h2 { font-size: 1.05rem; margin: 0 0 2px; }
.muted { color: #6b7280; font-size: 0.85rem; }
@media (prefers-color-scheme: dark) { .muted { color: #9aa3ad; } }
table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 0.86rem; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e3e6ea; vertical-align: top; }
@media (prefers-color-scheme: dark) { th, td { border-bottom-color: #2a2e35; } }
th { color: #6b7280; font-weight: 600; font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; }
a { color: #2b6cb0; } @media (prefers-color-scheme: dark) { a { color: #6fb0ef; } }
.bal { display: flex; align-items: baseline; gap: 8px; margin: 6px 0 12px; }
.bal .n { font-size: 1.6rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
button { font: inherit; font-weight: 600; padding: 8px 14px; border-radius: 8px; border: 1px solid #2b6cb0; background: #2b6cb0; color: #fff; cursor: pointer; }
button.ghost { background: transparent; color: #2b6cb0; }
button:disabled { opacity: 0.55; cursor: default; }
.lowbar { margin-top: 10px; padding: 10px 12px; border-radius: 8px; background: #fff6e5; border: 1px solid #f0d48a; color: #7a4f00; font-size: 0.85rem; }
@media (prefers-color-scheme: dark) { .lowbar { background: #2a2410; border-color: #5c4a16; color: #e0a558; } }
.status { margin-top: 8px; font-size: 0.85rem; }
.ok { color: #1f7a4d; } .err { color: #9b2c2c; }
@media (prefers-color-scheme: dark) { .ok { color: #5fd29a; } .err { color: #ef8d8d; } }
`;

const LOW_BALANCE_THRESHOLD = 100;

// ---- find_all results card --------------------------------------------------
const FIND_ALL_CARD_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https:; font-src https:; connect-src 'none'; form-action 'none'; frame-ancestors *; base-uri 'none'">
<title>Potarix find_all</title><style>${BASE_STYLE}</style></head>
<body><div class="wrap" id="root"><p class="muted">Loading results...</p></div>
<script>
${BRIDGE}
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c])); }
function render(params) {
  const d = resultJson(params);
  const root = document.getElementById("root");
  if (!d || d.error) { root.innerHTML = '<p class="err">No result to display.</p>'; return; }
  const dms = (d.decision_makers || []).filter((x) => x.email);
  const emails = d.company_emails || [];
  let html = '<h2>' + esc(d.company_name || "Company") + '</h2>';
  if (d.domain) html += '<div class="muted"><a href="https://' + esc(d.domain) + '" target="_blank" rel="noopener">' + esc(d.domain) + '</a></div>';
  if (dms.length) {
    html += '<table><thead><tr><th>Decision maker</th><th>Title</th><th>Email</th></tr></thead><tbody>';
    dms.forEach((m) => { html += '<tr><td>' + esc(m.name) + '</td><td>' + esc(m.job_title) + '</td><td>' + esc(m.email) + '</td></tr>'; });
    html += '</tbody></table>';
  }
  if (emails.length) {
    html += '<div class="muted">' + emails.length + ' company email(s): ' + emails.slice(0, 8).map((e) => esc(e.email)).join(", ") + (emails.length > 8 ? ", ..." : "") + '</div>';
  }
  const charged = d.credits_charged != null ? d.credits_charged : 0;
  const remaining = d.credits_remaining;
  html += '<div class="muted" style="margin-top:10px">' + (d.total_emails || (dms.length + emails.length)) + ' emails found. Charged ' + charged + ' credits' + (remaining != null ? '. ' + remaining + ' remaining.' : '.') + '</div>';
  if (remaining != null && remaining < ${LOW_BALANCE_THRESHOLD}) {
    html += '<div class="lowbar">Balance is low (' + remaining + ' credits). <div class="row"><button id="topup">Top up 5,000 credits</button></div><div class="status" id="status"></div></div>';
  }
  root.innerHTML = html;
  const btn = document.getElementById("topup");
  if (btn) btn.addEventListener("click", async () => {
    btn.disabled = true;
    const status = document.getElementById("status");
    status.textContent = "Charging saved card...";
    try {
      const r = await callTool("topup_credits", { tier_key: "5k" });
      const j = resultJson(r);
      status.innerHTML = j && j.credits_remaining != null
        ? '<span class="ok">Added. New balance: ' + j.credits_remaining + ' credits.</span>'
        : '<span class="ok">Top-up requested.</span>';
    } catch (e) {
      status.innerHTML = '<span class="err">Could not charge a saved card. Run start_checkout to add one.</span>';
      btn.disabled = false;
    }
  });
  reportSize();
}
</script></body></html>`;

// ---- balance / top-up card --------------------------------------------------
const TOPUP_CARD_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https:; font-src https:; connect-src 'none'; form-action 'none'; frame-ancestors *; base-uri 'none'">
<title>Potarix balance</title><style>${BASE_STYLE}</style></head>
<body><div class="wrap" id="root"><p class="muted">Loading balance...</p></div>
<script>
${BRIDGE}
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c])); }
const TIERS = [{ k: "1k", label: "1,000 / $10" }, { k: "5k", label: "5,000 / $50" }, { k: "25k", label: "25,000 / $250" }];
function render(params) {
  const d = resultJson(params) || {};
  const root = document.getElementById("root");
  const remaining = d.credits_remaining;
  const hasCard = d.has_saved_card === true;
  let html = '<h2>Potarix credits</h2>';
  html += '<div class="bal"><span class="n">' + (remaining != null ? remaining : "?") + '</span><span class="muted">credits remaining</span></div>';
  if (d.email) html += '<div class="muted">' + esc(d.email) + '</div>';
  html += '<div class="row">' + TIERS.map((t) => '<button class="ghost" data-tier="' + t.k + '">Top up ' + t.label + '</button>').join("") + '</div>';
  html += '<div class="status" id="status">' + (hasCard ? '' : 'No saved card yet. The first top-up opens a one-time checkout to add one.') + '</div>';
  root.innerHTML = html;
  root.querySelectorAll("button[data-tier]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tier = btn.getAttribute("data-tier");
      root.querySelectorAll("button").forEach((b) => (b.disabled = true));
      const status = document.getElementById("status");
      status.textContent = "Processing...";
      try {
        const r = await callTool(hasCard ? "topup_credits" : "start_checkout", { tier_key: tier });
        const j = resultJson(r) || {};
        if (j.url) status.innerHTML = 'Open this link to finish adding a card: <a href="' + esc(j.url) + '" target="_blank" rel="noopener">checkout</a>';
        else if (j.credits_remaining != null) status.innerHTML = '<span class="ok">Done. New balance: ' + j.credits_remaining + ' credits.</span>';
        else status.innerHTML = '<span class="ok">Request sent.</span>';
      } catch (e) {
        status.innerHTML = '<span class="err">Could not complete. Try start_checkout to add a card first.</span>';
        root.querySelectorAll("button").forEach((b) => (b.disabled = false));
      }
      reportSize();
    });
  });
  reportSize();
}
</script></body></html>`;

export function registerPotarixUiResources(server: McpServer): void {
  registerAppResource(
    server,
    "potarix-find-all-card",
    FIND_ALL_CARD_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [{ uri: FIND_ALL_CARD_URI, mimeType: RESOURCE_MIME_TYPE, text: FIND_ALL_CARD_HTML }],
    })
  );

  registerAppResource(
    server,
    "potarix-topup-card",
    TOPUP_CARD_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [{ uri: TOPUP_CARD_URI, mimeType: RESOURCE_MIME_TYPE, text: TOPUP_CARD_HTML }],
    })
  );
}
