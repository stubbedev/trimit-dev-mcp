import { z } from "zod";
import { ToolDefinition } from "../registry.js";
import { TRIMIT_AUTH, buildHeaders, buildOdataQuery, fetchExample, trimitBase } from "../common.js";

const CATEGORY = "masterdata";

export const masterdataTools: ToolDefinition[] = [
  {
    name: "trimit_masterdata_get_campaigns",
    description:
      "List TRIMIT Campaigns. Expands defaultDimensions and priceGroupParameters by default. Fields: id, number, description, salespersonCode, statusCode, startingDate, endingDate, activated, lastDateModified.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z.string().optional().describe("Default: 'defaultDimensions,priceGroupParameters'"),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? "defaultDimensions,priceGroupParameters";
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/campaigns${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "List TRIMIT Campaigns with default dimensions and price group parameters.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes:
          "lastDateModified is your incremental sync cursor — filter on it for deltas (BC has no /delta endpoint here).",
      };
    },
  },
  {
    name: "trimit_masterdata_get_customer_price_groups",
    description: "List Customer Price Groups with priceGroupParameters expanded. Supports $schemaversion=1.0.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z.string().optional().describe("Default: 'priceGroupParameters'"),
      schemaVersion: z.string().optional().describe("e.g. '1.0'"),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: {
      filter?: string;
      select?: string[];
      expand?: string;
      schemaVersion?: string;
      top?: number;
      skip?: number;
    }) => {
      const expand = args.expand ?? "priceGroupParameters";
      const { qs, params } = buildOdataQuery({ ...args, expand });
      let endpoint = `${trimitBase()}/customerPriceGroups${qs}`;
      if (args.schemaVersion) {
        const sep = endpoint.includes("?") ? "&" : "?";
        endpoint = `${endpoint}${sep}$schemaversion=${args.schemaVersion}`;
        params["$schemaversion"] = args.schemaVersion;
      }
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Customer Price Groups list.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_masterdata_get_price_group_parameters",
    description:
      "List Customer Price Group Parameters table directly. Recommended Data-Access-Intent: ReadOnly for large reads.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      top: z.number().optional(),
      skip: z.number().optional(),
      readOnly: z.boolean().optional().describe("Send Data-Access-Intent: ReadOnly header. Default true."),
    },
    handler: (args: { filter?: string; select?: string[]; top?: number; skip?: number; readOnly?: boolean }) => {
      const { qs, params } = buildOdataQuery(args);
      const endpoint = `${trimitBase()}/priceGroupParameters${qs}`;
      const extra = args.readOnly !== false ? { "Data-Access-Intent": "ReadOnly" } : undefined;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(extra),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Read price group parameters.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null, extra),
        auth: TRIMIT_AUTH,
        notes: "Data-Access-Intent: ReadOnly routes the request to a read replica when BC supports it — lower latency for analytics-style reads.",
      };
    },
  },
  {
    name: "trimit_masterdata_get_vardim_combinations",
    description: "List allowed VarDim Combinations (overall + subordinate variant dimension pairings).",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; top?: number; skip?: number }) => {
      const { qs, params } = buildOdataQuery(args);
      const endpoint = `${trimitBase()}/VarDimCombinations${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "VarDim combinations (allowed variant dimension pairs).",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_masterdata_get_vardim_types",
    description: "List VarDim Types (variant dimension definitions). Use $expand=vardimtypevalues to include values.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional().describe("e.g. \"No eq 'GL01'\""),
      select: z.array(z.string()).optional(),
      expand: z.string().optional().describe("e.g. 'vardimtypevalues'"),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const { qs, params } = buildOdataQuery(args);
      const endpoint = `${trimitBase()}/vardimtypes${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "VarDim types.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_masterdata_get_vardim_type_values",
    description: "List VarDim Type values (concrete variant dimension options).",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional().describe("e.g. \"value eq 'GB33'\""),
      select: z.array(z.string()).optional(),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; top?: number; skip?: number }) => {
      const { qs, params } = buildOdataQuery(args);
      const endpoint = `${trimitBase()}/vardimtypevalues${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "VarDim type values.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_masterdata_get_item_attributes",
    description: "List BC Item Attributes and their values.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      top: z.number().optional(),
      skip: z.number().optional(),
      readOnly: z.boolean().optional().describe("Send Data-Access-Intent: ReadOnly header. Default true."),
    },
    handler: (args: { filter?: string; select?: string[]; top?: number; skip?: number; readOnly?: boolean }) => {
      const { qs, params } = buildOdataQuery(args);
      const endpoint = `${trimitBase()}/itemAttributes${qs}`;
      const extra = args.readOnly !== false ? { "Data-Access-Intent": "ReadOnly" } : undefined;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(extra),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Item attributes.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null, extra),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_masterdata_get_collections",
    description: "List TRIMIT Collections (seasonal / grouping). Expand deliveryPeriods for delivery cycle data.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z.string().optional().describe("Default: 'deliveryPeriods'"),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? "deliveryPeriods";
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/collections${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "TRIMIT Collections.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
];
