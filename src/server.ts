import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ToolRegistry } from "./registry.js";
import {
  standardTools,
  masterdataTools,
  productsTools,
  inventoryTools,
  customersTools,
  salesdocsTools,
  postedsalesTools,
  exportedTools,
  metadataTools,
} from "./categories/index.js";
import type { ToolDefinition } from "./registry.js";
import { HOST, STD_API_PATH, TRIMIT_API_PATH, TRIMIT_AUTH, buildHeaders, trimitBase } from "./common.js";
import { ENTITIES, ENTITY_NAMES, findEntityByResourcePath, getEntity } from "./spec/entities.js";
import { ENUMS } from "./spec/enums.js";
import { buildPayload, entitySummary } from "./spec/payloads.js";
import { checkOdata } from "./spec/odata.js";
import { validateRequest } from "./spec/validate.js";
import { lintSnippet } from "./spec/lint.js";

const PKG_VERSION: string = (() => {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = resolve(here, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

// Static search lookup for search_trimit_api bootstrap tool
const TRIMIT_API_SEARCH_MAP: Array<{
  keywords: string[];
  endpoint: string;
  method: string;
  description: string;
  category: string;
}> = [
  // standard
  { keywords: ["company", "companies", "company id", "list companies", "tenant company"], endpoint: "/api/v2.0/companies", method: "GET", description: "List BC companies (standard MS API). Gives the companyId GUID required for every TRIMIT call.", category: "standard" },
  { keywords: ["odata company", "company odata", "odatav4 company"], endpoint: "/ODataV4/Company", method: "GET", description: "List companies via OData v4 endpoint.", category: "standard" },
  { keywords: ["bc items", "standard items", "items standard"], endpoint: "/api/v2.0/companies({id})/items", method: "GET", description: "Standard BC items list (not TRIMIT-enriched).", category: "standard" },
  { keywords: ["bc customer", "standard customer", "customer standard", "customer dimensions"], endpoint: "/api/v2.0/companies({id})/customers", method: "GET", description: "Standard BC customers with default dimensions.", category: "standard" },
  { keywords: ["patch customer", "update customer dimensions", "default dimensions patch"], endpoint: "/api/v2.0/companies({id})/customers({customerId})", method: "PATCH", description: "Patch a customer's default dimensions (standard BC API).", category: "standard" },
  { keywords: ["metadata", "edmx", "csdl", "schema", "$metadata"], endpoint: "/api/v2.0/$metadata", method: "GET", description: "EDMX schema for the standard MS BC API.", category: "standard" },
  { keywords: ["entity definitions", "entity definition"], endpoint: "/api/v2.0/entityDefinitions", method: "GET", description: "Entity definitions list.", category: "standard" },
  // masterdata
  { keywords: ["campaign", "campaigns", "trimit campaign", "promotion"], endpoint: "/companies({id})/campaigns", method: "GET", description: "TRIMIT campaigns with priceGroupParameters and dimensions.", category: "masterdata" },
  { keywords: ["price group", "customer price group", "price groups"], endpoint: "/companies({id})/customerPriceGroups", method: "GET", description: "Customer price groups.", category: "masterdata" },
  { keywords: ["price group parameters", "priceGroupParameters", "price params"], endpoint: "/companies({id})/priceGroupParameters", method: "GET", description: "Price group parameter rows.", category: "masterdata" },
  { keywords: ["vardim combinations", "variant combination", "variant pairs"], endpoint: "/companies({id})/VarDimCombinations", method: "GET", description: "Allowed VarDim combinations.", category: "masterdata" },
  { keywords: ["vardim", "variant dimension", "vardimtypes"], endpoint: "/companies({id})/vardimtypes", method: "GET", description: "Variant dimension types.", category: "masterdata" },
  { keywords: ["vardim values", "variant dimension values", "vardimtypevalues"], endpoint: "/companies({id})/vardimtypevalues", method: "GET", description: "Variant dimension values.", category: "masterdata" },
  { keywords: ["item attribute", "attributes", "bc attribute"], endpoint: "/companies({id})/itemAttributes", method: "GET", description: "Item attributes + values.", category: "masterdata" },
  { keywords: ["collection", "collections", "season", "season grouping", "delivery period"], endpoint: "/companies({id})/collections", method: "GET", description: "TRIMIT collections with deliveryPeriods.", category: "masterdata" },
  // products
  { keywords: ["master", "masters", "style", "style master", "master product"], endpoint: "/companies({id})/masters", method: "GET", description: "TRIMIT Masters (style/master products) with full expand.", category: "products" },
  { keywords: ["item", "items", "sku", "trimit item", "variant sku"], endpoint: "/companies({id})/items", method: "GET", description: "TRIMIT-enriched items / SKUs.", category: "products" },
  { keywords: ["product", "products", "product feed", "storefront"], endpoint: "/companies({id})/products", method: "GET", description: "Curated TRIMIT product feed (Masters + Items in configured categories).", category: "products" },
  { keywords: ["category", "categories", "product category"], endpoint: "/companies({id})/categories", method: "GET", description: "TRIMIT categories.", category: "products" },
  // inventory
  { keywords: ["location", "warehouse", "locations"], endpoint: "/companies({id})/locations", method: "GET", description: "Warehouses / locations master.", category: "inventory" },
  { keywords: ["inventory", "stock", "availability", "on hand", "future delivers"], endpoint: "/companies({id})/inventories", method: "GET", description: "Inventory / availability per (item, location).", category: "inventory" },
  // customers
  { keywords: ["customer", "customers", "trimit customer", "customer enriched"], endpoint: "/companies({id})/customers", method: "GET", description: "TRIMIT-enriched customers.", category: "customers" },
  { keywords: ["contact", "contacts"], endpoint: "/companies({id})/contacts", method: "GET", description: "Contact list.", category: "customers" },
  { keywords: ["salesperson", "salespersons", "sales rep"], endpoint: "/companies({id})/salespersons", method: "GET", description: "Salespersons list.", category: "customers" },
  { keywords: ["create customer", "new customer", "post customer"], endpoint: "/companies({id})/customers", method: "POST", description: "Create a TRIMIT customer.", category: "customers" },
  { keywords: ["patch customer", "update customer", "edit customer", "additional fields"], endpoint: "/companies({id})/customers({customerId})", method: "PATCH", description: "Patch a TRIMIT customer.", category: "customers" },
  // salesdocs
  { keywords: ["sales document", "salesDocuments", "sales doc", "sales journal"], endpoint: "/companies({id})/salesDocuments", method: "GET", description: "All sales documents in the Sales Import Journal.", category: "salesdocs" },
  { keywords: ["processed sales document", "processed documents", "imported documents"], endpoint: "/companies({id})/salesDocuments()", method: "GET", description: "Sales documents that have been processed into BC.", category: "salesdocs" },
  { keywords: ["sales order", "sales orders", "order list"], endpoint: "/companies({id})/salesOrders", method: "GET", description: "Sales orders.", category: "salesdocs" },
  { keywords: ["sales invoice", "sales invoices", "unposted invoice"], endpoint: "/companies({id})/salesInvoices", method: "GET", description: "Unposted sales invoices.", category: "salesdocs" },
  { keywords: ["credit memo", "sales credit memo", "credit memos"], endpoint: "/companies({id})/salesCreditMemos", method: "GET", description: "Unposted credit memos.", category: "salesdocs" },
  { keywords: ["return order", "sales return", "return orders"], endpoint: "/companies({id})/salesReturnOrders", method: "GET", description: "Sales return orders (API-created).", category: "salesdocs" },
  { keywords: ["create return order", "post return order", "new return"], endpoint: "/companies({id})/salesReturnOrders", method: "POST", description: "Create a return order.", category: "salesdocs" },
  { keywords: ["create sales document", "create order", "create invoice", "post sales document"], endpoint: "/companies({id})/salesDocuments", method: "POST", description: "Create a sales document (Quote/Order/Invoice/Credit Memo/Blanket Order/Return Order).", category: "salesdocs" },
  { keywords: ["batch sales document", "sales batch", "$batch", "bulk insert"], endpoint: "/companies({id})/$batch", method: "POST", description: "OData $batch sales document creates.", category: "salesdocs" },
  // postedsales
  { keywords: ["posted sales", "posted document", "posted documents"], endpoint: "/companies({id})/postedSalesDocuments", method: "GET", description: "Union of posted invoices + credit memos.", category: "postedsales" },
  { keywords: ["posted invoice", "posted sales invoice"], endpoint: "/companies({id})/postedSalesInvoices", method: "GET", description: "Posted sales invoices.", category: "postedsales" },
  { keywords: ["posted credit memo", "posted credit"], endpoint: "/companies({id})/postedSalesCreditMemos", method: "GET", description: "Posted credit memos.", category: "postedsales" },
  { keywords: ["return receipt", "posted return", "return receipts"], endpoint: "/companies({id})/postedSalesReturnReceipts", method: "GET", description: "Posted return receipts.", category: "postedsales" },
  { keywords: ["shipment", "posted shipment", "shipments", "tracking lines"], endpoint: "/companies({id})/postedSalesShipments", method: "GET", description: "Posted shipments with tracking lines.", category: "postedsales" },
  // exported
  { keywords: ["exported", "exported document", "mark exported", "is exported"], endpoint: "/companies({id})/exportedDocuments", method: "GET/POST/DELETE", description: "Track which docs have been exported to exclude them from future polls.", category: "exported" },
  // metadata
  { keywords: ["trimit metadata", "$metadata trimit", "edmx trimit", "schema trimit"], endpoint: "/api/trimit/integration/v1.1/$metadata", method: "GET", description: "EDMX schema for the TRIMIT integration API.", category: "metadata" },
];

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  standard: "Standard Microsoft Business Central API endpoints — companies, items, customers, OData metadata, entity definitions. Required for discovering companyId GUIDs.",
  masterdata: "TRIMIT master data — campaigns, customer price groups, price group parameters, VarDim combinations/types/values, item attributes, collections.",
  products: "Products — TRIMIT Masters (style headers), Items (SKUs), curated Products feed, categories.",
  inventory: "Inventory — warehouse locations and per-(item,location) availability (incl. Future Delivers).",
  customers: "TRIMIT-enriched customer resource (CRUD), contacts, salespersons.",
  salesdocs: "Open sales document lifecycle — list/create Quote, Order, Invoice, Credit Memo, Blanket Order, Return Order; $batch for bulk insert.",
  postedsales: "Posted sales documents — invoices, credit memos, return receipts, shipments with tracking.",
  exported: "Exported-document markers used to exclude already-processed sales docs from future GETs.",
  metadata: "TRIMIT integration API EDMX/$metadata for client codegen.",
};

const CATEGORY_TOOL_MAP: Record<string, ToolDefinition[]> = {
  standard: standardTools,
  masterdata: masterdataTools,
  products: productsTools,
  inventory: inventoryTools,
  customers: customersTools,
  salesdocs: salesdocsTools,
  postedsales: postedsalesTools,
  exported: exportedTools,
  metadata: metadataTools,
};

export class TrimitMcpServer {
  private mcpServer: McpServer;
  private registry: ToolRegistry;
  private categoryHandles: Map<string, ReturnType<McpServer["tool"]>[]> = new Map();

  constructor() {
    this.registry = new ToolRegistry();
    this.mcpServer = new McpServer(
      { name: "trimit-dev-assistant", version: PKG_VERSION },
      {
        capabilities: {
          tools: { listChanged: true },
          resources: { listChanged: false, subscribe: false },
          prompts: { listChanged: false },
        },
        instructions:
          "Use this server whenever the user is building, debugging, or learning about the TRIMIT API — the fashion/apparel ERP extension layered on Microsoft Dynamics 365 Business Central (api.businesscentral.dynamics.com). " +
          "It documents 47 endpoints across master data, products, inventory, customers, sales documents, posted sales, exported markers, and metadata.\n\n" +
          "WORKFLOW — choose the fastest path:\n" +
          "1. Intent is clear → call load_category directly:\n" +
          "   - companies / standard BC API / metadata schema → load_category('standard')\n" +
          "   - campaigns / price groups / vardim / attributes / collections → load_category('masterdata')\n" +
          "   - masters / items / products / categories → load_category('products')\n" +
          "   - inventory / stock / locations → load_category('inventory')\n" +
          "   - customers / contacts / salespersons → load_category('customers')\n" +
          "   - sales orders / invoices / credit memos / quotes / return orders / $batch → load_category('salesdocs')\n" +
          "   - posted invoices / posted credit memos / posted shipments / return receipts → load_category('postedsales')\n" +
          "   - mark a doc exported / un-mark exported → load_category('exported')\n" +
          "   - TRIMIT $metadata for client codegen → load_category('metadata')\n" +
          "2. Intent is ambiguous → call search_trimit_api to find the right category, then load it.\n" +
          "3. Conceptual questions → call the relevant trimit_explain_* tool directly:\n" +
          "   - OAuth 2.0 / Entra / tokens → trimit_explain_auth\n" +
          "   - Base URLs / tenant / environment / companyId / placeholder substitution → trimit_explain_base_urls\n" +
          "   - $filter / $select / $expand / $orderby → trimit_explain_odata\n" +
          "   - $batch / bulk inserts → trimit_explain_batch\n" +
          "   - If-Match / ETag / IEEE754Compatible / concurrency → trimit_explain_concurrency\n" +
          "   - @odata.nextLink / pagination → trimit_explain_paging\n" +
          "   - Sales document lifecycle / processed vs exported → trimit_explain_doc_lifecycle\n" +
          "   - Errors / 401 / 403 / 409 / 412 → trimit_explain_errors\n\n" +
          "VALIDATING USER CODE — use the spec tools:\n" +
          "   - trimit_describe_entity — fields, types, required/mutable, enums, navigation properties\n" +
          "   - trimit_example_payload — minimal or full POST/PATCH body template per entity\n" +
          "   - trimit_validate_request — check a constructed request (endpoint/method/headers/body) against the TRIMIT spec\n" +
          "   - trimit_check_odata — validate $filter / $select / $expand / $orderby / $top / $skip\n" +
          "   - trimit_lint_snippet — scan user's integration code for BC pitfalls (no If-Match, no nextLink loop, hardcoded token, missing IEEE754, etc.)\n\n" +
          "RESOURCES — readable spec catalog:\n" +
          "   - trimit://entity/{name}    — entity schema as JSON\n" +
          "   - trimit://enum/{name}      — enum allowed values\n" +
          "   - trimit://entities         — list of all entities\n" +
          "   - trimit://enums            — list of all enums\n" +
          "   - trimit://categories       — tool category catalog\n\n" +
          "PROMPTS — workflows:\n" +
          "   - review_sales_order_post   — audit a /salesDocuments POST body + headers\n" +
          "   - add_idempotent_export_loop — guide adding exportedDocuments marker logic to a poller\n\n" +
          "This server constructs TRIMIT API requests (endpoint, method, headers, body, code example, auth) — it does not execute them.",
      }
    );

    this.registerBootstrapTools();
    this.registerSpecTools();
    this.registerResources();
    this.registerPrompts();
  }

  private registerBootstrapTools(): void {
    // list_categories
    this.mcpServer.tool(
      "list_categories",
      "List all TRIMIT API resource categories with descriptions and load status. Categories: standard (Microsoft BC standard API), masterdata (campaigns/price groups/vardim/attributes/collections), products (masters/items/products feed), inventory (locations/availability), customers (CRUD/contacts/salespersons), salesdocs (orders/invoices/credit memos/$batch), postedsales (posted invoices/shipments/return receipts), exported (exported-doc markers), metadata ($metadata EDMX).",
      {},
      async () => {
        const categories = Object.entries(CATEGORY_DESCRIPTIONS).map(([name, description]) => ({
          name,
          description,
          loaded: this.registry.loadedCategories.has(name),
          toolCount: CATEGORY_TOOL_MAP[name]?.length ?? 0,
        }));
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ categories }, null, 2),
            },
          ],
        };
      }
    );

    // load_category
    this.mcpServer.tool(
      "load_category",
      "Activate TRIMIT API tools for a category. Call as soon as intent is clear — don't wait for confirmation. " +
      "Categories: 'standard' (BC standard API), 'masterdata' (campaigns/price groups/vardim/attributes/collections), " +
      "'products' (masters/items/products/categories), 'inventory' (locations/availability), 'customers' (TRIMIT customers CRUD + contacts/salespersons), " +
      "'salesdocs' (open sales documents + $batch), 'postedsales' (posted invoices/credit memos/return receipts/shipments), " +
      "'exported' (exported-doc markers), 'metadata' ($metadata). Multiple categories can be loaded simultaneously.",
      { category: z.string().describe("Category to load") },
      async ({ category }) => {
        const normalizedCategory = category.toLowerCase().trim();

        if (!CATEGORY_TOOL_MAP[normalizedCategory]) {
          const available = Object.keys(CATEGORY_TOOL_MAP).join(", ");
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `Unknown category '${normalizedCategory}'. Available: ${available}`,
                }),
              },
            ],
          };
        }

        if (this.registry.loadedCategories.has(normalizedCategory)) {
          const toolNames = this.registry.getAll()
            .filter((t) => t.category === normalizedCategory)
            .map((t) => t.name);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  message: `Category '${normalizedCategory}' is already loaded.`,
                  tools: toolNames,
                }),
              },
            ],
          };
        }

        const tools = CATEGORY_TOOL_MAP[normalizedCategory];
        const newToolNames = this.registry.registerCategory(normalizedCategory, tools);
        const handles = this.registerCategoryTools(normalizedCategory, tools);
        this.categoryHandles.set(normalizedCategory, handles);

        this.mcpServer.sendToolListChanged();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                message: `Loaded ${newToolNames.length} tools for category '${normalizedCategory}'.`,
                tools: newToolNames,
              }),
            },
          ],
        };
      }
    );

    // search_trimit_api
    this.mcpServer.tool(
      "search_trimit_api",
      "Search TRIMIT API endpoints by keyword. Covers masters/items/products, inventory, customers, contacts, salespersons, sales documents (quotes/orders/invoices/credit memos/return orders), posted sales (invoices/credit memos/return receipts/shipments), exported-doc markers, campaigns, price groups, vardim, attributes, collections, and standard BC endpoints (companies/items/customers/metadata/entity definitions).",
      { query: z.string().describe("Search terms, e.g. 'create order', 'inventory by location', 'mark exported', 'patch customer'") },
      async ({ query }) => {
        const lowerQuery = query.toLowerCase();
        const queryWords = lowerQuery.split(/\s+/);

        const scored = TRIMIT_API_SEARCH_MAP
          .map((entry) => {
            const score = entry.keywords.reduce((acc, keyword) => {
              if (lowerQuery.includes(keyword)) return acc + 2;
              const keywordWords = keyword.split(/\s+/);
              const matchCount = keywordWords.filter((kw) => queryWords.some((qw) => qw.includes(kw) || kw.includes(qw))).length;
              return acc + matchCount;
            }, 0);
            return { ...entry, score };
          })
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        if (scored.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  message: "No results. Try keywords like: company, master, item, product, inventory, customer, order, invoice, credit memo, posted, batch, exported, campaign, vardim, attribute, collection, metadata.",
                  results: [],
                }),
              },
            ],
          };
        }

        const suggestedCategory = scored[0].category;
        const results = scored.map(({ score: _score, ...rest }) => rest);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                query,
                suggestedCategory,
                hint: `Call load_category with '${suggestedCategory}' to get tools for this resource area.`,
                results,
              }, null, 2),
            },
          ],
        };
      }
    );

    // trimit_explain_auth
    this.mcpServer.tool(
      "trimit_explain_auth",
      "Explain TRIMIT API authentication — Microsoft Entra (Azure AD) OAuth 2.0 client credentials flow against Business Central.",
      {},
      async () => {
        const text = `# TRIMIT API Authentication

TRIMIT lives on top of Microsoft Dynamics 365 Business Central. **All authentication goes through Microsoft Entra (Azure AD)**, not TRIMIT directly.

## Flow: OAuth 2.0 Client Credentials (service-to-service)

\`\`\`
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={clientId}
&client_secret={clientSecret}
&scope=https://api.businesscentral.dynamics.com/.default
\`\`\`

Response includes \`access_token\`. Send it on every API call:

\`\`\`
Authorization: Bearer {token}
\`\`\`

## Prerequisites
1. **Azure AD app registration** in the customer's tenant
2. **Admin consent** for the Microsoft Graph + Business Central app permissions the integration needs
3. **Business Central setup**: in the BC client → **Microsoft Entra Applications** page → register the Entra app's client_id and assign it a **D365 BUS PREMIUM** or matching permission set
4. **TRIMIT integration license** enabled on the BC environment

## Tokens
- Default lifetime: ~1 hour
- Cache the token until ~5 min before expiry
- 401 'InvalidAuthenticationToken' usually means the token is expired or scoped to the wrong audience

## Tenant + Environment Substitution
- \`{tenant}\` — Entra tenant GUID (also used in the BC URL)
- \`{environment}\` — \`Production\`, \`Sandbox\`, or a custom env name created in the BC Admin Center
- \`{companyId}\` — BC company GUID; fetch with \`GET /api/v2.0/companies\` (use \`trimit_std_get_companies\`)

## Docs
- BC OAuth: https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/administration/authenticate-web-services-using-oauth
- TRIMIT integration overview: https://apidocs.trimit.com/`;
        return { content: [{ type: "text" as const, text }] };
      }
    );

    // trimit_explain_base_urls
    this.mcpServer.tool(
      "trimit_explain_base_urls",
      "Explain the TRIMIT / Business Central base URL structure and the placeholders ({tenant}, {environment}, {companyId}) you must substitute.",
      {},
      async () => {
        const text = `# TRIMIT / Business Central Base URLs

All endpoints share the host \`api.businesscentral.dynamics.com\` under the customer's Entra tenant. There are three logical bases:

\`\`\`
TRIMIT integration API
${HOST}/{tenant}/{environment}/${TRIMIT_API_PATH}/companies({companyId})

Standard Microsoft BC API
${HOST}/{tenant}/{environment}/${STD_API_PATH}/companies({companyId})

BC OData v4 endpoint
${HOST}/{tenant}/{environment}/ODataV4
\`\`\`

## Placeholders

| Placeholder | What it is | Example |
|---|---|---|
| \`{tenant}\` | Entra tenant GUID | \`72f988bf-86f1-…\` |
| \`{environment}\` | BC environment name | \`Production\`, \`Sandbox\`, \`uat\` |
| \`{companyId}\` | BC company GUID | \`c0c0c0c0-…\` — get via GET /companies |

## Resolving {companyId}
Run \`trimit_std_get_companies\`. The response contains a \`value\` array with \`{ id, name, displayName }\` entries. Use the \`id\` GUID.

## Versioning
- TRIMIT integration path is currently \`trimit/integration/v1.1\`. Older deployments expose \`v1.0\`.
- Standard BC API is currently \`api/v2.0\`.
- Some endpoints accept \`$schemaversion=1.0\` to lock the response schema.

## Sandbox vs Production
- Environment names are not case-sensitive in the URL but match what's shown in the BC Admin Center.
- Sandboxes can be created on demand and refreshed from production.`;
        return { content: [{ type: "text" as const, text }] };
      }
    );

    // trimit_explain_odata
    this.mcpServer.tool(
      "trimit_explain_odata",
      "Explain OData query parameters supported by the TRIMIT / Business Central API: $filter, $select, $expand, $orderby, $top, $skip, $count.",
      {},
      async () => {
        const text = `# OData Query Parameters

The TRIMIT API responds with **OData v4 JSON**. Every list endpoint accepts the standard query options.

## $filter
\`\`\`
?$filter=number eq '20002036'
?$filter=startswith(displayName,'ACME')
?$filter=lastDateModified gt 2024-01-01T00:00:00Z
\`\`\`

## $select — Narrow Fields
\`\`\`
?$select=id,number,description
\`\`\`

## $expand — Inline Related Entities
\`\`\`
?$expand=defaultDimensions,priceGroupParameters
?$expand=salesOrderLines($expand=additionalFields),additionalFields
\`\`\`
Nested expand uses the OData v4 form \`parent($expand=child)\`.

## $orderby
\`\`\`
?$orderby=lastDateModified desc
\`\`\`

## $top / $skip — Pagination
\`\`\`
?$top=100&$skip=200
\`\`\`
BC defaults to a 20 000-row page cap. Use \`@odata.nextLink\` for server-driven paging — see \`trimit_explain_paging\`.

## $count
\`\`\`
?$count=true
\`\`\`

## $batch
POST a JSON envelope to \`/$batch\` to combine many requests. See \`trimit_explain_batch\`.

## $schemaversion
Some TRIMIT endpoints accept \`$schemaversion=1.0\` to pin the response schema across upgrades.

## Encoding
Always URL-encode \`$filter\` values (quotes, slashes, spaces). Use the literal \`'\` (apostrophe) around string values, and double single-quotes inside strings.

## Docs
- BC OData: https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/webservices/odata-web-services
- OData v4 spec: https://docs.oasis-open.org/odata/odata/v4.01/`;
        return { content: [{ type: "text" as const, text }] };
      }
    );

    // trimit_explain_paging
    this.mcpServer.tool(
      "trimit_explain_paging",
      "Explain server-driven paging in the TRIMIT / BC OData API — @odata.nextLink iteration and the 20 000-row page cap.",
      {},
      async () => {
        const text = `# Pagination

BC OData uses **server-driven paging**. If more rows exist than fit in a page, the response contains an \`@odata.nextLink\` URL pointing to the next page. Page sizes default to **20 000 rows**.

## Iteration Pattern

\`\`\`javascript
async function getAllPages(initialUrl, token) {
  const all = [];
  let url = initialUrl;
  while (url) {
    const r = await fetch(url, { headers: { Authorization: \`Bearer \${token}\` } });
    if (!r.ok) throw new Error(\`HTTP \${r.status}: \${await r.text()}\`);
    const data = await r.json();
    if (data.value) all.push(...data.value);
    url = data['@odata.nextLink'] ?? null;
  }
  return all;
}
\`\`\`

## $top + $skip
Use these only for explicit pagination control. \`$top\` clamps the page size; \`$skip\` advances the cursor. Combined they let you implement a manual paginator, but \`@odata.nextLink\` is preferred for full sweeps.

## Delta sync
The TRIMIT API has **no /delta endpoint**. Use a \`lastDateModified gt <isoTimestamp>\` filter on entities that expose that field (campaigns, products, customers) to pull incremental changes.`;
        return { content: [{ type: "text" as const, text }] };
      }
    );

    // trimit_explain_concurrency
    this.mcpServer.tool(
      "trimit_explain_concurrency",
      "Explain optimistic concurrency in the TRIMIT / BC OData API — @odata.etag, If-Match header, and IEEE754Compatible decimals.",
      {},
      async () => {
        const text = `# Concurrency & Decimal Handling

## ETag-Based Optimistic Concurrency

Every GET on a single entity returns an \`@odata.etag\` value:

\`\`\`json
{
  "@odata.context": "…",
  "@odata.etag": "W/\\\"JzQ0O…\\\"",
  "id": "…"
}
\`\`\`

On **PATCH** or **DELETE** you must send that etag back as \`If-Match\`:

\`\`\`
PATCH /api/.../customers({id})
If-Match: W/"JzQ0O…"
\`\`\`

If the resource changed since you read it, BC returns **412 Precondition Failed** — re-GET to pick up the latest etag and retry.

## Unconditional Updates

Use \`If-Match: *\` to bypass the check entirely. Fine for integrations that own the data, dangerous for shared resources.

## IEEE754Compatible Header

\`\`\`
IEEE754Compatible: true
\`\`\`

When set, BC encodes decimals as JSON **strings** instead of numbers — preventing JavaScript precision loss for large or high-scale decimals (currency, quantities). Send it on PATCH bodies that include decimal fields, and on GETs whose response you'll round-trip.

## Body Format

PATCH bodies should be **partial** (only the fields you're changing). Sending \`null\` clears a field; omitting it leaves the field unchanged.`;
        return { content: [{ type: "text" as const, text }] };
      }
    );

    // trimit_explain_batch
    this.mcpServer.tool(
      "trimit_explain_batch",
      "Explain BC OData $batch — combine many sales document inserts into a single round-trip.",
      {},
      async () => {
        const text = `# OData $batch (Business Central)

POST a JSON batch envelope to \`/$batch\` under any of the company-scoped base URLs:

\`\`\`
POST ${HOST}/{tenant}/{environment}/${TRIMIT_API_PATH}/companies({companyId})/$batch
Authorization: Bearer {token}
Content-Type: application/json
\`\`\`

## Request Body

\`\`\`json
{
  "requests": [
    { "id": "1", "method": "POST", "url": "salesDocuments",
      "headers": { "Content-Type": "application/json" },
      "body": { "docType": "Order", "docNo": "SO1001", "sellToCustomerNo": "10000", "orderDate": "2026-05-18", "salesDocumentLines": [ ... ] } },
    { "id": "2", "method": "POST", "url": "salesDocuments",
      "headers": { "Content-Type": "application/json" },
      "body": { "docType": "Order", "docNo": "SO1002", ... } }
  ]
}
\`\`\`

\`url\` is **relative** to the batch base URL.

## dependsOn

Make a request wait for another to succeed:

\`\`\`json
{ "id": "2", "method": "POST", "url": "...", "dependsOn": ["1"] }
\`\`\`

## Response Shape

\`\`\`json
{
  "responses": [
    { "id": "1", "status": 201, "headers": { ... }, "body": { "@odata.etag": "...", ... } },
    { "id": "2", "status": 409, "headers": { ... }, "body": { "error": { "code": "Internal_EntityWithSameKeyExists", ... } } }
  ]
}
\`\`\`

- Responses can arrive **out of order** — match by \`id\`.
- A failed sub-request **does not** fail the whole batch (unless framing is invalid).
- Throttling: each sub-request counts independently against BC quotas.

## When To Use
- Bulk sales document inserts (\`trimit_salesdocs_post_lines_batch\`)
- Mixed CRUD across multiple TRIMIT entities in one round-trip
- Reducing 401-retry overhead during token refreshes

## Docs
https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/webservices/odata-using-batch`;
        return { content: [{ type: "text" as const, text }] };
      }
    );

    // trimit_build_batch
    this.mcpServer.tool(
      "trimit_build_batch",
      "Build a TRIMIT / BC OData $batch request body. Pass requests with method, relative url, body, and optional headers / dependsOn.",
      {
        requests: z.array(z.object({
          id: z.string().describe("Unique id within the batch"),
          method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]),
          url: z.string().describe("Relative URL, e.g. 'salesDocuments' or 'customers({id})'"),
          body: z.record(z.string(), z.unknown()).optional(),
          headers: z.record(z.string(), z.string()).optional(),
          dependsOn: z.array(z.string()).optional(),
        })).min(1).max(100),
      },
      async ({ requests }) => {
        const transformed = requests.map((req) => {
          const out: Record<string, unknown> = {
            id: req.id,
            method: req.method,
            url: req.url,
          };
          if (req.body !== undefined) out.body = req.body;

          const needsCT = ["POST", "PATCH", "PUT"].includes(req.method) && req.body !== undefined;
          if (req.headers || needsCT) {
            out.headers = {
              ...(needsCT ? { "Content-Type": "application/json" } : {}),
              ...(req.headers ?? {}),
            };
          }
          if (req.dependsOn?.length) out.dependsOn = req.dependsOn;
          return out;
        });

        const endpoint = `${trimitBase()}/$batch`;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                endpoint,
                method: "POST",
                headers: buildHeaders(),
                body: { requests: transformed },
                description: `Batch ${requests.length} TRIMIT API request${requests.length === 1 ? "" : "s"} into a single HTTP call.`,
                docsUrl: "https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/webservices/odata-using-batch",
                auth: TRIMIT_AUTH,
                notes:
                  "Responses arrive in 'responses'; match by id. Individual failures don't fail the batch. Sub-request URLs are relative to the batch base.",
                codeExample: `const response = await fetch('${endpoint}', {\n  method: 'POST',\n  headers: { 'Authorization': 'Bearer {token}', 'Content-Type': 'application/json' },\n  body: JSON.stringify(${JSON.stringify({ requests: transformed }, null, 2)})\n});\nconst { responses } = await response.json();\nfor (const r of responses) console.log(\`Request \${r.id}: HTTP \${r.status}\`);`,
              }, null, 2),
            },
          ],
        };
      }
    );

    // trimit_explain_doc_lifecycle
    this.mcpServer.tool(
      "trimit_explain_doc_lifecycle",
      "Explain the TRIMIT sales document lifecycle — Sales Import Journal, processedDate, exportedDocuments markers, and posted-document tables.",
      {},
      async () => {
        const text = `# Sales Document Lifecycle

Sales documents pass through three states in TRIMIT:

## 1. Open (Sales Import Journal)

\`POST /salesDocuments\` writes a new doc into the **TRIMIT Sales Import Journal**. \`releaseDocument: true\` releases it in BC immediately.

\`\`\`
GET /salesDocuments
\`\`\`
Returns **all** open documents — both unprocessed and processed-but-not-yet-marked-exported.

## 2. Processed

When BC processes the import journal row (manually or by job queue), it sets \`processedDate\` on the doc. Filter for processed docs with:

\`\`\`
GET /salesDocuments()?$filter=(processedDate gt 0001-01-01)
\`\`\`

A processed doc may still appear in /salesDocuments until you explicitly mark it exported.

## 3. Posted

After invoicing / shipping in BC, the doc moves to one of the **Posted** tables:

| Action | Source table |
|---|---|
| Posted invoice | postedSalesInvoices |
| Posted credit memo | postedSalesCreditMemos |
| Posted shipment | postedSalesShipments |
| Posted return receipt | postedSalesReturnReceipts |

The unposted record may be deleted from /salesDocuments by BC after posting.

## exportedDocuments — Marker, Not State

\`POST /exportedDocuments\` writes a marker that **excludes the doc from future GET /salesDocuments calls** (and the analogous typed lists). It does **not** change anything in BC — it's purely a client-state optimization so integrations can avoid re-processing the same doc.

\`\`\`
POST /exportedDocuments    { "type": "Order", "number": "SO1001" }
GET  /exportedDocuments('Order','SO1001')   → 200 if marked, 404 if not
DELETE /exportedDocuments('Order','SO1001') → 204
\`\`\`

\`documentType\` is case-sensitive. Accepted values include 'Quote', 'Order', 'Invoice', 'Credit Memo', 'Blanket Order', 'Return Order', 'Posted Invoice', 'Posted Credit Memo', 'Posted Shipment', 'Posted Return Receipt'.

## Recovery
If your downstream system loses a doc, DELETE the exported marker — the doc reappears in the next GET poll.`;
        return { content: [{ type: "text" as const, text }] };
      }
    );

    // trimit_explain_errors
    this.mcpServer.tool(
      "trimit_explain_errors",
      "Explain common TRIMIT / Business Central API error responses and how to fix them.",
      {},
      async () => {
        const text = `# Common Errors

BC returns errors as an OData envelope:

\`\`\`json
{
  "error": {
    "code": "BadRequest_InvalidRequest",
    "message": "…human readable message…"
  }
}
\`\`\`

## 400 Bad Request
- Malformed JSON body, wrong field types, missing required keys
- For sales docs: invalid \`docType\` (must be exactly 'Order', 'Quote', 'Invoice', 'Credit Memo', 'Blanket Order', 'Return Order' — case-sensitive)

## 401 Unauthorized
- \`InvalidAuthenticationToken\` → expired/wrong-audience token
  - Check audience: \`https://api.businesscentral.dynamics.com\`
  - Check tenant in token endpoint matches the URL tenant
- Missing \`Authorization: Bearer …\` header

## 403 Forbidden
- BC permission set on the Entra app does not grant access to this entity
- TRIMIT integration license not enabled on the environment

## 404 Not Found
- Wrong path segment (TRIMIT vs Standard API)
- Wrong company GUID
- Resource id wrong / deleted
- For \`exportedDocuments(type,number)\` 404 means *the marker doesn't exist*, not that the doc doesn't exist

## 409 Conflict
- \`Internal_EntityWithSameKeyExists\` — duplicate primary key (e.g. customer number, sales doc number)
  - Use a different number, or PATCH the existing record

## 412 Precondition Failed
- Stale \`If-Match\` etag — re-GET to refresh and retry the PATCH

## 429 Too Many Requests
BC's global throttling — back off and retry. Respect \`Retry-After\` if present.

## 5xx
Transient — retry with exponential backoff. Persistent 500s on a single record may indicate corrupt data in BC; surface to the BC admin.

## Debugging Tips
- Always log \`error.code\` and the response \`x-request-id\` / \`x-ms-correlation-request-id\` header — Microsoft support uses those for diagnosis
- For sales doc POSTs, the error body often includes per-line failure context — log the entire body

## Docs
https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/dynamics-error-codes`;
        return { content: [{ type: "text" as const, text }] };
      }
    );
  }

  private registerSpecTools(): void {
    // trimit_describe_entity
    this.mcpServer.tool(
      "trimit_describe_entity",
      "Return the schema for a TRIMIT entity: fields with types, required/mutable flags, enums, decimal markers, navigation properties, default $expand, and notes. Pass entity name (e.g. 'customer', 'salesDocument', 'salesReturnOrder', 'exportedDocument', 'master', 'item', 'campaign', 'inventory') OR resourcePath (e.g. 'customers', 'salesDocuments'). Call list_entities() shape via the trimit://entities resource for the full list.",
      {
        entity: z.string().optional().describe("Entity name from the registry"),
        resourcePath: z.string().optional().describe("URL segment, e.g. 'customers'"),
      },
      async ({ entity, resourcePath }) => {
        const resolved = entity ? getEntity(entity) : resourcePath ? findEntityByResourcePath(resourcePath) : undefined;
        if (!resolved) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    error: `Unknown entity. Provide one of: ${ENTITY_NAMES.join(", ")}`,
                    available: ENTITY_NAMES,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(entitySummary(resolved), null, 2) },
          ],
        };
      }
    );

    // trimit_example_payload
    this.mcpServer.tool(
      "trimit_example_payload",
      "Generate a request body template for an entity. shape='minimal' returns only required fields (create) or one mutable field (patch); shape='full' returns every writable field with placeholder values. Decimal fields are emitted as numbers — wrap as strings if you send IEEE754Compatible: true.",
      {
        entity: z.string().describe("Entity name, e.g. 'customer', 'salesDocument', 'salesReturnOrder'"),
        operation: z.enum(["create", "patch"]).default("create"),
        shape: z.enum(["minimal", "full"]).default("minimal"),
      },
      async ({ entity, operation, shape }) => {
        const e = getEntity(entity);
        if (!e) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: `Unknown entity '${entity}'`, available: ENTITY_NAMES }, null, 2),
              },
            ],
          };
        }
        const payload = buildPayload(entity, operation, shape);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  entity,
                  operation,
                  shape,
                  method: operation === "create" ? "POST" : "PATCH",
                  contentType: "application/json",
                  recommendedHeaders:
                    operation === "patch"
                      ? { "If-Match": "*", "IEEE754Compatible": "true" }
                      : { "IEEE754Compatible": "true" },
                  body: payload,
                  notes: e.notes,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // trimit_validate_request
    this.mcpServer.tool(
      "trimit_validate_request",
      "Validate a constructed TRIMIT/BC request against the spec. Checks base path, placeholder substitution, required headers (Authorization, Content-Type, If-Match on PATCH/DELETE, IEEE754Compatible when decimals are present), body shape (required fields, unknown fields, enum casing, type mismatches, immutable fields on PATCH), nested arrays (e.g. salesDocumentLines), $batch envelope, and embedded OData query parameters. Returns a list of issues with severity, code, path, and fix suggestion.",
      {
        endpoint: z.string().describe("Full URL with or without placeholders"),
        method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]),
        headers: z.record(z.string(), z.string()).optional(),
        body: z.unknown().optional(),
      },
      async ({ endpoint, method, headers, body }) => {
        const issues = validateRequest({ endpoint, method, headers, body });
        const errors = issues.filter((i) => i.severity === "error").length;
        const warnings = issues.filter((i) => i.severity === "warning").length;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  summary: { errors, warnings, info: issues.length - errors - warnings, total: issues.length },
                  ok: errors === 0,
                  issues,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // trimit_check_odata
    this.mcpServer.tool(
      "trimit_check_odata",
      "Validate an OData query against the TRIMIT spec. Checks $filter (parenthesis balance, quote escaping, '=' vs 'eq', null compares, datetime format, unknown fields), $select (unknown fields), $expand (unknown navigation properties, OData v4 nested syntax), $orderby, $top (page cap), $skip. Pass entity or resourcePath to enable field-name resolution.",
      {
        entity: z.string().optional(),
        resourcePath: z.string().optional(),
        filter: z.string().optional(),
        select: z.array(z.string()).optional(),
        expand: z.string().optional(),
        orderby: z.string().optional(),
        top: z.number().optional(),
        skip: z.number().optional(),
      },
      async (args) => {
        const issues = checkOdata(args);
        const errors = issues.filter((i) => i.severity === "error").length;
        const warnings = issues.length - errors;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  summary: { errors, warnings, total: issues.length },
                  ok: errors === 0,
                  issues,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // trimit_lint_snippet
    this.mcpServer.tool(
      "trimit_lint_snippet",
      "Scan a user's integration code (JS/TS/Python/curl) for common TRIMIT/BC pitfalls: hardcoded tokens, missing token-refresh, missing @odata.nextLink loop, PATCH without If-Match, decimal fields without IEEE754Compatible, no 429/Retry-After handling, polling /salesDocuments without exportedDocuments markers, $batch sub-requests without id or with absolute URLs, $filter using '=' instead of 'eq', unquoted string literals, case-wrong docType, wrong API base for TRIMIT resources.",
      {
        snippet: z.string().describe("Source code, fetch call, or pseudocode to lint"),
      },
      async ({ snippet }) => {
        const findings = lintSnippet(snippet);
        const errors = findings.filter((f) => f.severity === "error").length;
        const warnings = findings.filter((f) => f.severity === "warning").length;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  summary: { errors, warnings, info: findings.length - errors - warnings, total: findings.length },
                  ok: errors === 0,
                  findings,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );
  }

  private registerResources(): void {
    // trimit://entities — list of all entities
    this.mcpServer.registerResource(
      "entities",
      "trimit://entities",
      {
        title: "TRIMIT entities",
        description: "List of all known TRIMIT/BC entities exposed in the spec catalog.",
        mimeType: "application/json",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                entities: Object.values(ENTITIES).map((e) => ({
                  name: e.name,
                  resourcePath: e.resourcePath,
                  category: e.category,
                  apiBase: e.apiBase,
                  keys: e.keys,
                })),
              },
              null,
              2
            ),
          },
        ],
      })
    );

    // trimit://enums — list of all enums
    this.mcpServer.registerResource(
      "enums",
      "trimit://enums",
      {
        title: "TRIMIT enums",
        description: "List of all enums referenced by entity fields.",
        mimeType: "application/json",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ enums: Object.values(ENUMS) }, null, 2),
          },
        ],
      })
    );

    // trimit://categories — tool category catalog
    this.mcpServer.registerResource(
      "categories",
      "trimit://categories",
      {
        title: "TRIMIT tool categories",
        description: "Lazy-loadable tool categories with descriptions and tool counts.",
        mimeType: "application/json",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                categories: Object.entries(CATEGORY_DESCRIPTIONS).map(([name, description]) => ({
                  name,
                  description,
                  toolCount: CATEGORY_TOOL_MAP[name]?.length ?? 0,
                  loaded: this.registry.loadedCategories.has(name),
                })),
              },
              null,
              2
            ),
          },
        ],
      })
    );

    // trimit://entity/{name}
    this.mcpServer.registerResource(
      "entity",
      new ResourceTemplate("trimit://entity/{name}", {
        list: async () => ({
          resources: Object.values(ENTITIES).map((e) => ({
            uri: `trimit://entity/${e.name}`,
            name: e.name,
            description: `${e.resourcePath} (${e.category}) — ${e.fields.length} fields`,
            mimeType: "application/json",
          })),
        }),
        complete: {
          name: async (value) =>
            ENTITY_NAMES.filter((n) => n.toLowerCase().startsWith(value.toLowerCase())).slice(0, 20),
        },
      }),
      {
        title: "TRIMIT entity schema",
        description: "Field-level schema for a single entity.",
        mimeType: "application/json",
      },
      async (uri, variables) => {
        const name = String(variables.name);
        const entity = getEntity(name);
        if (!entity) {
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify({ error: `Unknown entity '${name}'`, available: ENTITY_NAMES }, null, 2),
              },
            ],
          };
        }
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(entitySummary(entity), null, 2),
            },
          ],
        };
      }
    );

    // trimit://enum/{name}
    this.mcpServer.registerResource(
      "enum",
      new ResourceTemplate("trimit://enum/{name}", {
        list: async () => ({
          resources: Object.values(ENUMS).map((e) => ({
            uri: `trimit://enum/${e.name}`,
            name: e.name,
            description: e.description,
            mimeType: "application/json",
          })),
        }),
        complete: {
          name: async (value) =>
            Object.keys(ENUMS)
              .filter((n) => n.toLowerCase().startsWith(value.toLowerCase()))
              .slice(0, 20),
        },
      }),
      {
        title: "TRIMIT enum",
        description: "Allowed values for a single enum.",
        mimeType: "application/json",
      },
      async (uri, variables) => {
        const name = String(variables.name);
        const e = ENUMS[name];
        if (!e) {
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify({ error: `Unknown enum '${name}'`, available: Object.keys(ENUMS) }, null, 2),
              },
            ],
          };
        }
        return {
          contents: [
            { uri: uri.href, mimeType: "application/json", text: JSON.stringify(e, null, 2) },
          ],
        };
      }
    );
  }

  private registerPrompts(): void {
    this.mcpServer.registerPrompt(
      "review_sales_order_post",
      {
        title: "Review /salesDocuments POST",
        description: "Audit a sales document create payload against the TRIMIT spec, with emphasis on docType casing, line types, decimals, releaseDocument behavior, and IEEE754Compatible.",
        argsSchema: {
          body: z.string().describe("JSON body the client intends to POST to /salesDocuments"),
          headers: z.string().optional().describe("Optional JSON object of headers"),
        },
      },
      ({ body, headers }) => ({
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                "Audit this /salesDocuments POST against the TRIMIT spec. Then call trimit_validate_request with the parsed body/headers and report the findings inline.\n\n" +
                "Specifically check:\n" +
                "1. docType casing — must match enum exactly ('Order', not 'order').\n" +
                "2. salesDocumentLines[].type — must be in salesLineType enum, case-sensitive.\n" +
                "3. Decimals (unitPrice, quantity, discountAmount) — recommend IEEE754Compatible: true with string values.\n" +
                "4. orderDate — YYYY-MM-DD only.\n" +
                "5. releaseDocument behavior — true releases in BC immediately; ensure caller intends this.\n" +
                "6. additionalFields shape on header vs lines.\n" +
                "7. Header completeness — Authorization, Content-Type, IEEE754Compatible.\n\n" +
                "Body:\n```json\n" +
                body +
                "\n```\n" +
                (headers ? "Headers:\n```json\n" + headers + "\n```\n" : "") +
                "\nReturn: a numbered list of issues with severity, then the corrected body if applicable.",
            },
          },
        ],
      })
    );

    this.mcpServer.registerPrompt(
      "add_idempotent_export_loop",
      {
        title: "Add idempotent export loop",
        description: "Guide refactoring a /salesDocuments poller to use /exportedDocuments markers so the same doc is not re-processed.",
        argsSchema: {
          snippet: z.string().describe("Current polling code"),
          language: z.string().optional().describe("Source language hint, e.g. typescript / python"),
        },
      },
      ({ snippet, language }) => ({
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                "Refactor this TRIMIT /salesDocuments poller into an idempotent export loop using /exportedDocuments markers. Call trimit_lint_snippet on the input first and address any findings related to lifecycle/paging/auth.\n\n" +
                "Required behavior of the rewrite:\n" +
                "1. GET /salesDocuments() with $filter=(processedDate gt 0001-01-01) so only processed docs come back.\n" +
                "2. Iterate @odata.nextLink until exhausted.\n" +
                "3. For each doc, after successful downstream handoff, POST /exportedDocuments {type, number}.\n" +
                "4. On downstream failure, do NOT POST the marker — the doc must reappear on next poll.\n" +
                "5. Handle 401 by refreshing the token and retrying once.\n" +
                "6. Respect 429 Retry-After.\n" +
                "7. Recovery: document how to DELETE /exportedDocuments(type, number) to re-include a doc.\n\n" +
                (language ? `Source language: ${language}\n\n` : "") +
                "Current code:\n```\n" +
                snippet +
                "\n```",
            },
          },
        ],
      })
    );
  }

  private registerCategoryTools(
    _categoryName: string,
    tools: ToolDefinition[]
  ): ReturnType<McpServer["tool"]>[] {
    const handles: ReturnType<McpServer["tool"]>[] = [];

    for (const tool of tools) {
      const handle = this.mcpServer.tool(
        tool.name,
        tool.description,
        tool.zodShape,
        async (args: Record<string, unknown>) => {
          try {
            const result = tool.handler(args);
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({ error: message }),
                },
              ],
              isError: true,
            };
          }
        }
      );
      handles.push(handle);
    }

    return handles;
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
  }
}
