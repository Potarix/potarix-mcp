# Potarix MCP Server

MCP wrapper for Potarix Enricher. Lets AI agents resolve company websites, find verified emails, and pull complete company rosters — and (with one human-in-the-loop card capture) sign up and pay for credits entirely from the agent.

<!-- mcp-name: io.github.Potarix/potarix-mcp -->

## Tools

| tool | what it does | cost |
|---|---|---|
| `lookup_company_website` | company name → website URL | 2 credits |
| `find_person_email` | named person + company/domain → verified email | 25 credits |
| `find_decision_maker_email` | category + domain → likely buyer name + email | 25 credits |
| `find_linkedin_email` | LinkedIn profile URL → verified email | 10 credits |
| `find_company_emails` | domain → public company contact roster | 25 credits |
| `find_all` | one company name → website + DMs + full company email list | sum of above |
| `check_balance` | credits, email, saved-card status, key count | free |
| `start_checkout` | get a Stripe URL to add a card the first time | n/a |
| `topup_credits` | charge the saved card and add credits | n/a |

1 credit = $0.01. Trial accounts start with 25 free credits. Every endpoint floors at the worst-case provider COGS — a hit never loses money, and short-circuited waterfall calls earn margin.

## Two ways to connect

| transport | endpoint | best for |
|---|---|---|
| Streamable HTTP (hosted) | `https://api.potarix.com/mcp` | remote agents (Claude, ChatGPT) — no install |
| stdio (npm package) | `npx -y potarix-mcp` | local/desktop clients |

Both expose the same nine tools. The hosted server is stateless and multi-tenant: every request is authorized by its own `Authorization: Bearer ptk_live_...` header, so there is no per-user deployment.

### Hosted (Streamable HTTP)

Point any MCP client that speaks Streamable HTTP at `https://api.potarix.com/mcp` and send your key as a bearer token:

```jsonc
{
  "mcpServers": {
    "potarix": {
      "url": "https://api.potarix.com/mcp",
      "headers": { "Authorization": "Bearer ptk_live_your_key" }
    }
  }
}
```

### Install (stdio)

```bash
npm install -g potarix-mcp
```

Or run it without a global install:

```bash
npx -y potarix-mcp
```

## Configure

Set your Potarix API key:

```bash
export POTARIX_API_KEY=ptk_live_your_key
```

Optional:

```bash
export POTARIX_API=https://api.potarix.com/enricher
```

## Claude Desktop

```json
{
  "mcpServers": {
    "potarix": {
      "command": "npx",
      "args": ["-y", "potarix-mcp"],
      "env": {
        "POTARIX_API_KEY": "ptk_live_your_key"
      }
    }
  }
}
```

## Claude Code

```bash
claude mcp add potarix npx -- -y potarix-mcp
```

Then add `POTARIX_API_KEY` to the environment where Claude Code runs.

## Development

```bash
npm install
npm run build
npm run smoke        # stdio transport: connect + tools/list

# Streamable HTTP transport:
npm run start:http   # serves on http://127.0.0.1:8080/mcp (set PORT to change)
# in another shell:
POTARIX_MCP_URL=http://127.0.0.1:8080/mcp npm run smoke:http
```

Environment variables:

| var | default | purpose |
|---|---|---|
| `POTARIX_API_KEY` | — | API key (stdio only; HTTP reads it per-request from the bearer header) |
| `POTARIX_MCP_TRANSPORT` | `stdio` | `http` to run the Streamable HTTP server (or pass `--http`) |
| `PORT` / `HOST` | `8080` / `127.0.0.1` | HTTP bind address |
| `POTARIX_MCP_PATH` | `/mcp` | HTTP request path |
| `POTARIX_MCP_ALLOWED_HOSTS` | — | comma-separated host allow-list; enables DNS-rebinding protection |
| `POTARIX_API` | `https://api.potarix.com/enricher` | API base URL override |

## Registry Publishing

This repo includes `server.json` for the official MCP Registry.

Publishing steps:

```bash
npm publish
mcp-publisher login github
mcp-publisher publish
```

The package `mcpName` in `package.json` must match `server.json`:

```text
io.github.Potarix/potarix-mcp
```
