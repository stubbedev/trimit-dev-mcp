import { z } from "zod";
import { ToolDefinition } from "../registry.js";
import {
  HOST,
  STD_API_PATH,
  TRIMIT_API_PATH,
  TRIMIT_AUTH,
  buildHeaders,
  buildOdataQuery,
  fetchExample,
  stdBase,
  stdRoot,
  tenantRoot,
} from "../common.js";

const CATEGORY = "standard";

export const standardTools: ToolDefinition[] = [
  {
    name: "trimit_std_get_companies",
    description:
      "List Business Central companies in the tenant (Standard MS API). Returns each company id GUID — required for every TRIMIT call.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional().describe("OData $filter expression"),
      select: z.array(z.string()).optional().describe("Fields to return"),
    },
    handler: (args: { filter?: string; select?: string[] }) => {
      const { qs, params } = buildOdataQuery({ filter: args.filter, select: args.select });
      const endpoint = `${stdRoot()}/companies${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}" },
        queryParams: params,
        body: null,
        description: "List BC companies via the standard MS BC API. Use a company id with every other TRIMIT call.",
        docsUrl: "https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/api/dynamics_company",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes:
          "Standard BC API base path is /api/v2.0; this does NOT live under the TRIMIT integration path. Response is OData v4 JSON: { '@odata.context': ..., value: [{ id, name, displayName, ... }] }.",
      };
    },
  },
  {
    name: "trimit_std_get_companies_odata",
    description: "List companies via the BC OData v4 endpoint (parallel to the Standard API). Returns the same data via OData.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; top?: number; skip?: number }) => {
      const { qs, params } = buildOdataQuery(args);
      const endpoint = `${tenantRoot()}/ODataV4/Company${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}" },
        queryParams: params,
        body: null,
        description: "OData v4 view of companies.",
        docsUrl: "https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/webservices/odata-web-services",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: "OData endpoint is /ODataV4 (not /api/...). Useful for legacy OData clients.",
      };
    },
  },
  {
    name: "trimit_std_get_items",
    description: "List items via the Standard MS BC API (BC built-in Item table — not the TRIMIT-enriched item resource).",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z.string().optional(),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const { qs, params } = buildOdataQuery(args);
      const endpoint = `${stdBase()}/items${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Standard BC items list.",
        docsUrl: "https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/api/dynamics_item",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: "For TRIMIT-extended items (variants, master link, extended descriptions) use trimit_products_get_items instead.",
      };
    },
  },
  {
    name: "trimit_std_get_customers",
    description:
      "List customers via the Standard MS BC API with default dimensions expanded.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z
        .string()
        .optional()
        .describe("OData $expand; defaults to 'defaultDimensions' if omitted"),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? "defaultDimensions";
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${stdBase()}/customers${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "List BC customers with default dimensions.",
        docsUrl: "https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/api/dynamics_customer",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes:
          "Use trimit_customers_list for the TRIMIT-enriched customer resource (picture, priceGroupParameters, contactsInformation, configuredFields, etc.).",
      };
    },
  },
  {
    name: "trimit_std_patch_customer",
    description:
      "Patch a customer's default dimensions via the Standard MS BC API. Requires If-Match header for OData concurrency control.",
    category: CATEGORY,
    zodShape: {
      customerId: z.string().describe("Customer systemId GUID"),
      ifMatch: z.string().default("*").describe("ETag for OData concurrency. '*' = unconditional."),
      defaultDimensions: z
        .array(
          z.object({
            parentType: z.literal("Customer"),
            parentId: z.string(),
            dimensionCode: z.string(),
            dimensionValueCode: z.string(),
          })
        )
        .describe("Default dimension assignments"),
    },
    handler: (args: {
      customerId: string;
      ifMatch?: string;
      defaultDimensions: Array<{ parentType: "Customer"; parentId: string; dimensionCode: string; dimensionValueCode: string }>;
    }) => {
      const endpoint = `${stdBase()}/customers(${args.customerId})?$expand=defaultDimensions`;
      const body = { defaultDimensions: args.defaultDimensions };
      const headers = buildHeaders({ "If-Match": args.ifMatch ?? "*" });
      return {
        endpoint,
        method: "PATCH",
        headers,
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}", customerId: args.customerId },
        queryParams: { $expand: "defaultDimensions" },
        body,
        description: "Patch customer default dimensions.",
        docsUrl: "https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/api/dynamics_customer_update",
        codeExample: fetchExample(endpoint, "PATCH", body, { "If-Match": args.ifMatch ?? "*" }),
        auth: TRIMIT_AUTH,
        notes:
          "BC OData requires If-Match for PATCH. Use '*' for unconditional update or the resource @odata.etag value for optimistic concurrency.",
      };
    },
  },
  {
    name: "trimit_std_get_metadata",
    description: "Get the CSDL/EDMX metadata document for the Standard MS BC API ($metadata).",
    category: CATEGORY,
    zodShape: {},
    handler: () => {
      const endpoint = `${HOST}/{tenant}/{environment}/${STD_API_PATH}/$metadata`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders({ Accept: "application/xml" }),
        pathParams: { tenant: "{tenant}", environment: "{environment}" },
        queryParams: {},
        body: null,
        description: "Standard BC API $metadata (XML).",
        docsUrl: "https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/",
        codeExample: fetchExample(endpoint, "GET", null, { Accept: "application/xml" }),
        auth: TRIMIT_AUTH,
        notes: "Use for client codegen (e.g. odata2ts, openapi-from-edmx). Returns XML, not JSON.",
      };
    },
  },
  {
    name: "trimit_std_get_metadata_odata",
    description: "Get the CSDL/EDMX metadata document for the BC OData v4 endpoint.",
    category: CATEGORY,
    zodShape: {},
    handler: () => {
      const endpoint = `${tenantRoot()}/ODataV4/$metadata`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders({ Accept: "application/xml" }),
        pathParams: { tenant: "{tenant}", environment: "{environment}" },
        queryParams: {},
        body: null,
        description: "Metadata for the BC ODataV4 endpoint (different from the /api/v2.0 metadata).",
        docsUrl: "https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/webservices/odata-web-services",
        codeExample: fetchExample(endpoint, "GET", null, { Accept: "application/xml" }),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_std_get_entity_definitions",
    description: "List entity definitions in the Standard MS BC API.",
    category: CATEGORY,
    zodShape: {},
    handler: () => {
      const endpoint = `${HOST}/{tenant}/{environment}/${STD_API_PATH}/entityDefinitions`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}" },
        queryParams: {},
        body: null,
        description: "Discover entity definitions (BC entity schema introspection).",
        docsUrl: "https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
];

// Re-export base paths for help tools
export const _STANDARD_BASES = {
  std: STD_API_PATH,
  trimit: TRIMIT_API_PATH,
  host: HOST,
};
