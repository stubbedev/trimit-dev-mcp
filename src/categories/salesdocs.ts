import { z } from "zod";
import { ToolDefinition } from "../registry.js";
import { TRIMIT_AUTH, buildHeaders, buildOdataQuery, fetchExample, trimitBase } from "../common.js";

const CATEGORY = "salesdocs";

const DOC_TYPES = ["Quote", "Order", "Invoice", "Credit Memo", "Blanket Order", "Return Order"] as const;
const SALES_LINE_TYPES = ["Item", "G/L Account", "Resource", "Fixed Asset", "Charge (Item)", "Comment"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_MSG = "YYYY-MM-DD";

export const salesdocsTools: ToolDefinition[] = [
  {
    name: "trimit_salesdocs_list",
    description:
      "List all sales documents currently in the TRIMIT Sales Import Journal (Quote/Order/Invoice/Credit Memo/Blanket Order/Return Order, both unprocessed and processed).",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z
        .string()
        .optional()
        .describe("Default: 'salesDocumentLines($expand=additionalFields),additionalFields'"),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? "salesDocumentLines($expand=additionalFields),additionalFields";
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/salesDocuments${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "All open sales documents.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes:
          "Use the exportedDocuments helpers (category 'exported') to mark a doc as exported and exclude it from this list on future polls.",
      };
    },
  },
  {
    name: "trimit_salesdocs_list_processed",
    description: "List sales documents that have been processed (imported into BC). Filters processedDate > 0001-01-01.",
    category: CATEGORY,
    zodShape: {
      extraFilter: z.string().optional().describe("Additional OData $filter ANDed with the processed filter"),
      expand: z.string().optional(),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { extraFilter?: string; expand?: string; top?: number; skip?: number }) => {
      const filter = args.extraFilter
        ? `(processedDate gt 0001-01-01) and (${args.extraFilter})`
        : `(processedDate gt 0001-01-01)`;
      const expand = args.expand ?? "salesDocumentLines($expand=additionalFields),additionalFields";
      const { qs, params } = buildOdataQuery({ filter, expand, top: args.top, skip: args.skip });
      const endpoint = `${trimitBase()}/salesDocuments()${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Sales documents that have been imported into BC.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_salesdocs_get_processed_one",
    description: "Get one processed sales document by systemId.",
    category: CATEGORY,
    zodShape: {
      systemId: z.string().describe("Document systemId (GUID)"),
      expand: z.string().optional(),
    },
    handler: (args: { systemId: string; expand?: string }) => {
      const expand = args.expand ?? "salesDocumentLines($expand=additionalFields),additionalFields";
      const { qs, params } = buildOdataQuery({ expand });
      const endpoint = `${trimitBase()}/salesDocuments(${args.systemId})${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}", systemId: args.systemId },
        queryParams: params,
        body: null,
        description: "Single sales document by GUID.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_salesdocs_list_orders",
    description: "List sales orders only.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      expand: z.string().optional(),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? "salesOrderLines($expand=additionalFields),additionalFields";
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/salesOrders${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Sales orders list.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_salesdocs_list_invoices",
    description: "List unposted sales invoices.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      expand: z.string().optional(),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? "salesInvoiceLines($expand=additionalFields),additionalFields";
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/salesInvoices${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Unposted sales invoices.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: "Posted invoices live under category 'postedsales'.",
      };
    },
  },
  {
    name: "trimit_salesdocs_list_credit_memos",
    description: "List unposted sales credit memos.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      expand: z.string().optional(),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? "salesCreditMemoLines($expand=additionalFields),additionalFields";
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/salesCreditMemos${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Unposted credit memos.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_salesdocs_list_return_orders",
    description: "List sales return orders. Only returns orders **created via this API** are visible here.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      expand: z.string().optional(),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? "salesReturnOrderLines($expand=additionalFields),additionalFields";
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/salesReturnOrders${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Sales return orders (API-created only).",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes:
          "Return orders created directly in the BC client are not surfaced here — by design. To see all posted return receipts use trimit_postedsales_list_return_receipts.",
      };
    },
  },
  {
    name: "trimit_salesdocs_create_return_order",
    description: "Create a sales return order.",
    category: CATEGORY,
    zodShape: {
      returnOrderNo: z.string(),
      sellToCustomerNo: z.string().optional(),
      SellToCustomerName: z.string().optional(),
      sellToEmail: z.string().optional(),
      selltoPhoneNo: z.string().optional(),
      orderDate: z.string().regex(ISO_DATE, ISO_DATE_MSG),
      releaseDocument: z.boolean().optional(),
      additionalFields: z
        .array(z.object({ number: z.string().optional(), name: z.string(), value: z.string() }))
        .optional(),
      salesReturnOrderLines: z
        .array(
          z.object({
            lineNo: z.number().int(),
            type: z.enum(SALES_LINE_TYPES).describe("Usually 'Item'. Case-sensitive."),
            no: z.string().describe("Item number"),
            unitPrice: z.number().describe("Decimal — string when IEEE754Compatible: true."),
            quantity: z.number().describe("Decimal — string when IEEE754Compatible: true."),
            locationCode: z.string().optional(),
            additionalFields: z
              .array(z.object({ name: z.string(), value: z.string() }))
              .optional(),
          })
        )
        .min(1),
    },
    handler: (args: Record<string, unknown>) => {
      const expand = "salesReturnOrderLines($expand=additionalFields),additionalFields";
      const { qs, params } = buildOdataQuery({ expand });
      const endpoint = `${trimitBase()}/salesReturnOrders${qs}`;
      const body = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));
      return {
        endpoint,
        method: "POST",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body,
        description: "Create a return order.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "POST", body),
        auth: TRIMIT_AUTH,
        notes:
          "releaseDocument=true releases the return order in BC immediately. additionalFields on header and line write to configuredFields tables.",
      };
    },
  },
  {
    name: "trimit_salesdocs_post_add_fields",
    description:
      "Append lines / set additionalFields on an existing sales document. Variant of /salesDocuments POST that targets an already-existing docType+docNo.",
    category: CATEGORY,
    zodShape: {
      docType: z.enum(DOC_TYPES),
      docNo: z.string(),
      SellToCustomerName: z.string().optional(),
      orderDate: z.string().regex(ISO_DATE, ISO_DATE_MSG).optional(),
      releaseDocument: z.boolean().optional(),
      additionalFields: z
        .array(z.object({ name: z.string(), value: z.string() }))
        .optional(),
      salesDocumentLines: z
        .array(
          z.object({
            lineNo: z.number().int().optional(),
            type: z.enum(SALES_LINE_TYPES).describe("Case-sensitive."),
            no: z.string(),
            unitPrice: z.number().optional().describe("Decimal — string when IEEE754Compatible: true."),
            quantity: z.number().optional().describe("Decimal — string when IEEE754Compatible: true."),
            unitOfMeasureCode: z.string().optional(),
            locationCode: z.string().optional(),
            periodCode: z.string().optional(),
            discountAmount: z.number().optional().describe("Decimal — string when IEEE754Compatible: true."),
            additionalFields: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
          })
        )
        .optional(),
    },
    handler: (args: Record<string, unknown>) => {
      const endpoint = `${trimitBase()}/salesDocuments`;
      const body = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));
      return {
        endpoint,
        method: "POST",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: {},
        body,
        description: "Append fields/lines to an existing sales document.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "POST", body),
        auth: TRIMIT_AUTH,
        notes:
          "Same endpoint URL as create — the server distinguishes 'add fields' vs 'create' by whether docNo already exists. Use trimit_salesdocs_create for new docs to keep intent explicit.",
      };
    },
  },
  {
    name: "trimit_salesdocs_create",
    description:
      "Create a new sales document (Quote / Order / Invoice / Credit Memo / Blanket Order / Return Order) with one or more lines.",
    category: CATEGORY,
    zodShape: {
      docType: z.enum(DOC_TYPES),
      docNo: z.string().describe("Customer-facing document number (unique per docType)"),
      sellToCustomerNo: z.string().describe("BC customer number, e.g. '10000'"),
      orderDate: z.string().regex(ISO_DATE, ISO_DATE_MSG),
      releaseDocument: z.boolean().optional().describe("Release the doc in BC on create."),
      additionalFields: z
        .array(z.object({ name: z.string(), value: z.string() }))
        .optional(),
      salesDocumentLines: z
        .array(
          z.object({
            type: z.enum(SALES_LINE_TYPES).describe("Case-sensitive."),
            no: z.string().describe("Item number / G/L account / etc."),
            unitPrice: z.number().describe("Decimal — string when IEEE754Compatible: true."),
            quantity: z.number().describe("Decimal — string when IEEE754Compatible: true."),
            unitOfMeasureCode: z.string().optional(),
            locationCode: z.string().optional(),
            periodCode: z.string().optional(),
            discountAmount: z.number().optional().describe("Decimal — string when IEEE754Compatible: true."),
            additionalFields: z
              .array(z.object({ name: z.string(), value: z.string() }))
              .optional(),
          })
        )
        .min(1),
    },
    handler: (args: Record<string, unknown>) => {
      const endpoint = `${trimitBase()}/salesDocuments`;
      const body = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));
      return {
        endpoint,
        method: "POST",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: {},
        body,
        description: "Create a sales document.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "POST", body),
        auth: TRIMIT_AUTH,
        notes:
          "201 returns the created entity with @odata.etag and systemId. Use trimit_salesdocs_post_lines_batch to push many docs in a single round-trip.",
      };
    },
  },
  {
    name: "trimit_salesdocs_post_lines_batch",
    description:
      "Bulk-create sales documents / lines via OData $batch. Pass any number of POST requests; one round-trip.",
    category: CATEGORY,
    zodShape: {
      requests: z
        .array(
          z.object({
            method: z.literal("POST"),
            url: z.string().describe("Relative URL, e.g. companies({id})/salesDocumentLines"),
            body: z.record(z.string(), z.unknown()),
            headers: z.record(z.string(), z.string()).optional(),
          })
        )
        .min(1),
    },
    handler: (args: { requests: Array<{ method: "POST"; url: string; body: unknown; headers?: Record<string, string> }> }) => {
      const endpoint = `${trimitBase()}/$batch`;
      const body = {
        requests: args.requests.map((r) => ({
          method: r.method,
          url: r.url,
          body: r.body,
          headers: r.headers ?? { "Content-Type": "application/json" },
        })),
      };
      return {
        endpoint,
        method: "POST",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: {},
        body,
        description: "Batch sales document creates.",
        docsUrl: "https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/webservices/odata-using-batch",
        codeExample: fetchExample(endpoint, "POST", body),
        auth: TRIMIT_AUTH,
        notes:
          "BC $batch envelope follows the OData v4 JSON batch spec. The whole batch fails together only if framing is invalid; individual requests get their own status. Each sub-URL is relative to the OData service root.",
      };
    },
  },
];
