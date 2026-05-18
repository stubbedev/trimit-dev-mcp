# trimit-mcp

MCP server that generates request templates for the [TRIMIT API](https://apidocs.trimit.com/) — the fashion/apparel ERP extension on Microsoft Dynamics 365 Business Central.

Constructs the URL, method, headers, OData query string, body, and an OAuth-ready `fetch` snippet for every documented endpoint. Does **not** execute requests and holds no credentials.

- 47 endpoint tools across 9 resource categories, lazy-loaded on demand
- 17 always-on tools: search, category management, `$batch` builder, conceptual reference (`trimit_explain_*`), spec validators (`trimit_describe_entity`, `trimit_example_payload`, `trimit_validate_request`, `trimit_check_odata`, `trimit_lint_snippet`)
- MCP resources: `trimit://entity/{name}`, `trimit://enum/{name}`, `trimit://entities`, `trimit://enums`, `trimit://categories`
- MCP prompts: `review_sales_order_post`, `add_idempotent_export_loop`
- Zod input schemas; OData v4 (`$filter`/`$select`/`$expand`/`$orderby`/`$top`/`$skip`/`$count`) built-in
- Handles ETag (`If-Match`), `IEEE754Compatible` decimals, `@odata.nextLink` paging, `$batch` envelopes
- TRIMIT integration path `api/trimit/integration/v1.1`, standard BC path `api/v2.0`, OData v4 at `/ODataV4`

## Install

`npx -y @stubbedev/trimit-mcp` (stdio transport).

### Claude Code

```bash
claude mcp add trimit-dev -- npx -y @stubbedev/trimit-mcp
```

Or `.mcp.json`:

```json
{
  "mcpServers": {
    "trimit-dev": { "command": "npx", "args": ["-y", "@stubbedev/trimit-mcp"] }
  }
}
```

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "trimit-dev": { "command": "npx", "args": ["-y", "@stubbedev/trimit-mcp"] }
  }
}
```

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "trimit-dev": { "command": "npx", "args": ["-y", "@stubbedev/trimit-mcp"] }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "trimit-dev": { "command": "npx", "args": ["-y", "@stubbedev/trimit-mcp"] }
  }
}
```

### Zed

`settings.json`:

```json
{
  "context_servers": {
    "trimit-dev": { "command": { "path": "npx", "args": ["-y", "@stubbedev/trimit-mcp"] } }
  }
}
```

### OpenCode

`~/.config/opencode/config.json`:

```json
{
  "mcp": {
    "trimit-dev": { "type": "local", "command": ["npx", "-y", "@stubbedev/trimit-mcp"] }
  }
}
```

### Codex (OpenAI)

`~/.codex/config.toml`:

```toml
[mcp_servers.trimit-dev]
command = "npx"
args = ["-y", "@stubbedev/trimit-mcp"]
```

## Architecture

Bootstrap tools are registered at startup. Endpoint tools register only after `load_category` is called for their category — each call emits `notifications/tools/list_changed`. This keeps the active tool surface small (~12 tools idle, +N per loaded category).

Every endpoint tool returns:

```ts
{
  endpoint: string;          // fully-qualified URL with {tenant}/{environment}/{companyId} placeholders
  method: "GET" | "POST" | "PATCH" | "DELETE";
  headers: Record<string, string>;
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;  // OData $-params
  body: unknown | null;
  description: string;
  docsUrl: string;
  codeExample: string;       // ready-to-paste fetch() snippet
  auth: { type, tokenEndpoint, scope, notes };
  notes: string | null;      // gotchas (read-replica hints, case-sensitivity, etc.)
}
```

## Bootstrap tools

| Tool | Purpose |
|---|---|
| `list_categories` | Enumerate categories + loaded state + tool count |
| `load_category` | Register tools for a category, emit `tools/list_changed` |
| `search_trimit_api` | Keyword → endpoint match with `suggestedCategory` |
| `trimit_build_batch` | Build `/$batch` envelope (validates method, `dependsOn`, headers) |
| `trimit_explain_auth` | OAuth 2.0 client credentials + Entra app prerequisites |
| `trimit_explain_base_urls` | URL anatomy + placeholder resolution |
| `trimit_explain_odata` | Query parameter reference w/ examples |
| `trimit_explain_paging` | `@odata.nextLink` pattern; 20 000-row BC page cap |
| `trimit_explain_concurrency` | `@odata.etag` / `If-Match` / `IEEE754Compatible` |
| `trimit_explain_batch` | `$batch` envelope spec + response matching |
| `trimit_explain_doc_lifecycle` | Sales Import Journal → processed → posted; `exportedDocuments` markers |
| `trimit_explain_errors` | 400/401/403/404/409/412/429 + BC error codes |
| `trimit_describe_entity` | Field schema for an entity (types, required/mutable, enum refs, decimals, nav props, default `$expand`) |
| `trimit_example_payload` | Generate minimal/full POST or PATCH body template for an entity |
| `trimit_validate_request` | Validate `{endpoint, method, headers, body}` against the spec — issues + fix suggestions |
| `trimit_check_odata` | Validate `$filter` / `$select` / `$expand` / `$orderby` / `$top` / `$skip` |
| `trimit_lint_snippet` | Lint user integration code for BC pitfalls (no `If-Match`, no `nextLink`, hardcoded token, missing IEEE754, doctype casing, `=` vs `eq`, etc.) |

## Resources

| URI | Returns |
|---|---|
| `trimit://entities` | Catalog of all entities |
| `trimit://entity/{name}` | Schema for one entity (URI completion supported) |
| `trimit://enums` | Catalog of all enums |
| `trimit://enum/{name}` | Allowed values for one enum |
| `trimit://categories` | Tool category catalog with load state |

## Prompts

| Name | Produces |
|---|---|
| `review_sales_order_post` | Audit a `/salesDocuments` POST body + headers against the spec |
| `add_idempotent_export_loop` | Refactor a poller to use `/exportedDocuments` markers |

## Categories

| Category | N | Endpoints |
|---|---|---|
| `standard` | 8 | `companies`, `companies` (OData v4), `items`, `customers` (GET + PATCH `defaultDimensions` w/ `If-Match`), `$metadata` (REST + OData), `entityDefinitions` |
| `masterdata` | 8 | `campaigns`, `customerPriceGroups`, `priceGroupParameters`, `VarDimCombinations`, `vardimtypes`, `vardimtypevalues`, `itemAttributes`, `collections` |
| `products` | 4 | `masters`, `items`, `products`, `categories` (sensible default `$expand`) |
| `inventory` | 2 | `locations`, `inventories` (Future Delivers when enabled) |
| `customers` | 5 | TRIMIT `customers` list, `contacts`, `salespersons`, POST customer, PATCH customer (`additionalFields`, `If-Match`, `IEEE754Compatible`) |
| `salesdocs` | 11 | `salesDocuments` list/processed/by-systemId, typed lists (`salesOrders`/`salesInvoices`/`salesCreditMemos`/`salesReturnOrders`), POST return order, POST sales doc (create + append), `/$batch` |
| `postedsales` | 5 | `postedSalesDocuments`, `postedSalesInvoices`, `postedSalesCreditMemos`, `postedSalesReturnReceipts`, `postedSalesShipments` (w/ `trackingLines`) |
| `exported` | 3 | `exportedDocuments` GET/POST/DELETE |
| `metadata` | 1 | TRIMIT `$metadata` EDMX |

## Auth

OAuth 2.0 client credentials against Microsoft Entra:

```
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
grant_type=client_credentials
&client_id={clientId}
&client_secret={clientSecret}
&scope=https://api.businesscentral.dynamics.com/.default
```

Send `Authorization: Bearer {token}` on every call. Tokens ~1h. Requires an Entra app registration on the customer tenant, admin consent, and a matching BC permission set (e.g. `D365 BUS PREMIUM`).

Placeholders to substitute before issuing requests: `{tenant}` (Entra GUID), `{environment}` (`Production` / `Sandbox` / custom), `{companyId}` (BC company GUID — resolve via `trimit_std_get_companies`).

## Development

```bash
git clone https://github.com/stubbedev/trimit-dev-mcp.git
cd trimit-dev-mcp
npm install
npm run build     # tsc → dist/
npm run dev       # tsx watch
npm start         # node dist/index.js
```

Smoke check (boots server, validates `tools/list` response, asserts non-empty + well-formed):

```bash
npm run smoke:validate
```

Interactive debugging:

```bash
npx @modelcontextprotocol/inspector npx -y @stubbedev/trimit-mcp
```

Release (runs `preversion` → build + smoke, then tags, pushes, creates GitHub release):

```bash
npm run release:patch   # | release:minor | release:major
```

Layout:

```
src/
  index.ts            # entry
  server.ts           # McpServer + bootstrap tools
  registry.ts         # ToolRegistry (per-category load/unload)
  common.ts           # base URLs, buildOdataQuery, fetchExample, TRIMIT_AUTH
  categories/         # one file per category, exports ToolDefinition[]
  spec/
    types.ts          # Entity/Field/EnumDef types
    enums.ts          # Static enum catalog (docType, customerType, salesLineType, ...)
    entities.ts       # Entity registry — fields/keys/nav props/defaultExpand
    payloads.ts       # buildPayload(entity, op, shape) → request body templates
    odata.ts          # $filter/$select/$expand/$orderby validators
    validate.ts       # validateRequest({endpoint, method, headers, body})
    lint.ts           # lintSnippet(code) — BC pitfall heuristics
```

Add an endpoint: append a `ToolDefinition` to the relevant `categories/*.ts`, re-export if new category, add a `CATEGORY_TOOL_MAP` entry + description in `server.ts`.

## License

[MIT](./LICENSE)
