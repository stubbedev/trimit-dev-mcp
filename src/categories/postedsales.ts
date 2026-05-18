import { z } from "zod";
import { ToolDefinition } from "../registry.js";
import { TRIMIT_AUTH, buildHeaders, buildOdataQuery, fetchExample, trimitBase } from "../common.js";

const CATEGORY = "postedsales";

export const postedsalesTools: ToolDefinition[] = [
  {
    name: "trimit_postedsales_list_documents",
    description: "List posted sales documents (union of posted invoices + posted credit memos).",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z.string().optional().describe("Default: 'postedSalesDocumentLines'"),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? "postedSalesDocumentLines";
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/postedSalesDocuments${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Posted sales documents.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_postedsales_list_invoices",
    description: "List posted sales invoices (Sales Invoice Header).",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z.string().optional().describe("Default: 'postedSalesInvoiceLines,trackingLines'"),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? "postedSalesInvoiceLines,trackingLines";
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/postedSalesInvoices${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Posted sales invoices.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_postedsales_list_credit_memos",
    description: "List posted sales credit memos.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z.string().optional().describe("Default: 'postedSalesCreditMemoLines,trackingLines'"),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? "postedSalesCreditMemoLines,trackingLines";
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/postedSalesCreditMemos${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Posted credit memos.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_postedsales_list_return_receipts",
    description: "List posted sales return receipts (Return Receipt Header).",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z.string().optional().describe("Default: 'postedSalesReturnReceiptLines'"),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? "postedSalesReturnReceiptLines";
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/postedSalesReturnReceipts${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Posted return receipts (read-only).",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_postedsales_list_shipments",
    description: "List posted sales shipments with tracking lines.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z.string().optional().describe("Default: 'postedSalesShipmentLines,trackingLines'"),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? "postedSalesShipmentLines,trackingLines";
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/postedSalesShipments${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Posted shipments.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: "trackingLines contain serial / package tracking data when configured in BC.",
      };
    },
  },
];
