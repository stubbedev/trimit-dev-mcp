import { z } from "zod";
import { ToolDefinition } from "../registry.js";
import { TRIMIT_AUTH, buildHeaders, buildOdataQuery, fetchExample, trimitBase } from "../common.js";

const CATEGORY = "inventory";

export const inventoryTools: ToolDefinition[] = [
  {
    name: "trimit_inventory_get_locations",
    description: "List warehouse locations.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; top?: number; skip?: number }) => {
      const { qs, params } = buildOdataQuery(args);
      const endpoint = `${trimitBase()}/locations${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Warehouse / location master.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_inventory_get_inventories",
    description:
      "Get inventory / availability per (item, location). When TRIMIT 'Export Future Delivers' is enabled, includes pre-order stock.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional().describe("e.g. \"itemNo eq '20002036'\" or filter on locationCode"),
      select: z.array(z.string()).optional(),
      top: z.number().optional(),
      skip: z.number().optional(),
      readOnly: z.boolean().optional().describe("Send Data-Access-Intent: ReadOnly. Default true."),
    },
    handler: (args: { filter?: string; select?: string[]; top?: number; skip?: number; readOnly?: boolean }) => {
      const { qs, params } = buildOdataQuery(args);
      const endpoint = `${trimitBase()}/inventories${qs}`;
      const extra = args.readOnly !== false ? { "Data-Access-Intent": "ReadOnly" } : undefined;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(extra),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Inventory availability per (item, location).",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null, extra),
        auth: TRIMIT_AUTH,
        notes:
          "For frequent inventory polling prefer narrow filters + Data-Access-Intent: ReadOnly. Heavy aggregations should use $top/$skip pagination.",
      };
    },
  },
];
