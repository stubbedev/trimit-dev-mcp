# TRIMIT Dev MCP

An MCP server that helps you construct and validate [TRIMIT API](https://apidocs.trimit.com/) calls — the fashion/apparel ERP extension layered on Microsoft Dynamics 365 Business Central. No authentication required in the server itself.

Tools are loaded on demand by resource category. Ask about sales orders and the salesdocs tools appear. Ask about masters and the products tools appear. The server starts lean and grows with your needs, and always knows the OAuth setup, URL templating, and OData conventions for every operation.

## What it does

- Constructs valid TRIMIT / Business Central API request URLs, methods, headers, and bodies
- Validates required and optional parameters via Zod schemas
- Returns the OAuth 2.0 / Microsoft Entra setup for every operation
- Returns ready-to-use fetch code examples
- Links to official documentation
- Explains cross-cutting concepts: OAuth auth, base URL templating, OData queries, ETag concurrency, `$batch`, paging, sales document lifecycle
- Loads resource categories on demand — only what you need

## Tools

### Always available

These tools are loaded immediately — no setup required.

| Tool | Description |
|---|---|
| `list_categories` | List all resource categories and which are currently loaded |
| `load_category` | Load tools for a category; triggers `tools/list_changed` |
| `search_trimit_api` | Search TRIMIT API endpoints by keyword; returns a `suggestedCategory` to load |
| `trimit_build_batch` | Build a valid `/$batch` request body from any number of operations |
| `trimit_explain_auth` | OAuth 2.0 client credentials against Microsoft Entra |
| `trimit_explain_base_urls` | Base URL structure; `{tenant}`, `{environment}`, `{companyId}` substitution |
| `trimit_explain_odata` | `$filter`, `$select`, `$expand`, `$orderby`, `$top`, `$count` with examples |
| `trimit_explain_paging` | `@odata.nextLink` iteration and the BC 20 000-row page cap |
| `trimit_explain_concurrency` | `@odata.etag`, `If-Match`, `IEEE754Compatible` decimals |
| `trimit_explain_batch` | OData `$batch` envelope, `dependsOn`, response matching |
| `trimit_explain_doc_lifecycle` | Sales Import Journal → processed → posted; `exportedDocuments` markers |
| `trimit_explain_errors` | 400 / 401 / 403 / 404 / 409 / 412 / 429 and BC error codes |

### Resource categories (loaded on demand)

| Category | Tools | What you get |
|---|---|---|
| **standard** | 8 | Microsoft BC standard API: companies (incl. ODataV4 view), items, customers (GET + PATCH defaultDimensions), `$metadata` (API + ODataV4), entityDefinitions |
| **masterdata** | 8 | Campaigns, customerPriceGroups, priceGroupParameters, VarDimCombinations, vardimtypes, vardimtypevalues, itemAttributes, collections |
| **products** | 4 | TRIMIT Masters (style headers), Items (SKUs), Products feed, Categories — all with full expand defaults |
| **inventory** | 2 | Locations, Inventories (incl. Future Delivers) |
| **customers** | 5 | TRIMIT-enriched customers list, contacts, salespersons, POST customer, PATCH customer (additionalFields, If-Match, IEEE754Compatible) |
| **salesdocs** | 11 | Quote / Order / Invoice / Credit Memo / Blanket Order / Return Order — list, list-processed, get-by-systemId, typed lists (orders/invoices/credit memos/return orders), POST return order, POST sales document (create + add-fields), `$batch` bulk insert |
| **postedsales** | 5 | Posted documents (union), posted invoices, posted credit memos, posted return receipts, posted shipments (with tracking lines) |
| **exported** | 3 | GET / POST / DELETE `exportedDocuments` markers — exclude already-processed docs from future polls |
| **metadata** | 1 | TRIMIT integration API `$metadata` (EDMX) for codegen |

### Example tool output

Every tool returns a structured object with the full request details and auth requirements:

```json
{
  "endpoint": "https://api.businesscentral.dynamics.com/v2.0/{tenant}/{environment}/api/trimit/integration/v1.1/companies({companyId})/masters?$expand=masterDescriptions,masterDefDims,...",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer {token}",
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
  "pathParams": { "tenant": "{tenant}", "environment": "{environment}", "companyId": "{companyId}" },
  "queryParams": { "$expand": "masterDescriptions,masterDefDims,..." },
  "body": null,
  "description": "TRIMIT Masters (style headers).",
  "docsUrl": "https://apidocs.trimit.com/",
  "codeExample": "const response = await fetch('...', { method: 'GET', headers: { Authorization: 'Bearer {token}' } });\nconst data = await response.json();",
  "auth": {
    "type": "OAuth 2.0 — Microsoft Entra (Azure AD) client credentials",
    "tokenEndpoint": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
    "scope": "https://api.businesscentral.dynamics.com/.default",
    "notes": "Customer-tenant Entra app registration with Business Central / TRIMIT integration consent."
  },
  "notes": "Key fields: number (master code), noSystem (SKU template), masterItems → SKU variants. Heavy payload — narrow with $select and trimmed $expand for production traffic."
}
```

---

## Installation

The recommended way to run this server is via `npx` — no local install needed.

```
npx -y @stubbedev/trimit-mcp
```

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "trimit-dev": {
      "command": "npx",
      "args": ["-y", "@stubbedev/trimit-mcp"]
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add trimit-dev -- npx -y @stubbedev/trimit-mcp
```

Or add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "trimit-dev": {
      "command": "npx",
      "args": ["-y", "@stubbedev/trimit-mcp"]
    }
  }
}
```

### Cursor

Open **Settings → MCP** and add a new server, or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "trimit-dev": {
      "command": "npx",
      "args": ["-y", "@stubbedev/trimit-mcp"]
    }
  }
}
```

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "trimit-dev": {
      "command": "npx",
      "args": ["-y", "@stubbedev/trimit-mcp"]
    }
  }
}
```

### Zed

Edit your `settings.json` (open via **Zed → Settings → Open Settings**):

```json
{
  "context_servers": {
    "trimit-dev": {
      "command": {
        "path": "npx",
        "args": ["-y", "@stubbedev/trimit-mcp"]
      }
    }
  }
}
```

### OpenCode

Edit `~/.config/opencode/config.json`:

```json
{
  "mcp": {
    "trimit-dev": {
      "type": "local",
      "command": ["npx", "-y", "@stubbedev/trimit-mcp"]
    }
  }
}
```

### Codex (OpenAI)

Edit `~/.codex/config.json`:

```json
{
  "mcpServers": {
    "trimit-dev": {
      "command": "npx",
      "args": ["-y", "@stubbedev/trimit-mcp"]
    }
  }
}
```

---

## Development

```bash
git clone https://github.com/stubbedev/trimit-dev-mcp.git
cd trimit-dev-mcp
npm install
npm run build
npm start
```

For live reload during development:

```bash
npm run dev
```

### Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector npx -y @stubbedev/trimit-mcp
```

---

## License

MIT
