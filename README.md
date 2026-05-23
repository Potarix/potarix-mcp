# Potarix MCP Server

Tiny MCP wrapper for Potarix Enricher. It lets AI agents find company websites and verified business emails from the same places they already discover tools.

<!-- mcp-name: io.github.Potarix/potarix-mcp -->

## Tools

- `lookup_company_website` - company name to website URL
- `find_person_email` - named person plus company or domain to verified email
- `find_decision_maker_email` - category plus domain to likely buyer email
- `find_linkedin_email` - LinkedIn profile URL to verified email
- `find_company_emails` - domain to public company contacts

These tools call the Potarix Enricher API and use account credits.

## Install

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
npm run smoke
```

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
