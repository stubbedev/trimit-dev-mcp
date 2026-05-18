import { z } from "zod";
import { ToolDefinition } from "../registry.js";
import { TRIMIT_AUTH, buildHeaders, fetchExample, trimitBase } from "../common.js";

const CATEGORY = "exported";

const DOC_TYPES = [
  "Quote",
  "Order",
  "Invoice",
  "Credit Memo",
  "Blanket Order",
  "Return Order",
  "Posted Invoice",
  "Posted Credit Memo",
  "Posted Shipment",
  "Posted Return Receipt",
] as const;

export const exportedTools: ToolDefinition[] = [
  {
    name: "trimit_exported_get",
    description:
      "Check whether a specific document has been marked exported (and is therefore excluded from default sales document polls).",
    category: CATEGORY,
    zodShape: {
      documentType: z.enum(DOC_TYPES).describe("Case-sensitive doc type"),
      documentNumber: z.string(),
    },
    handler: (args: { documentType: (typeof DOC_TYPES)[number]; documentNumber: string }) => {
      const endpoint = `${trimitBase()}/exportedDocuments('${encodeURIComponent(args.documentType)}','${encodeURIComponent(args.documentNumber)}')`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: {
          tenant: "{tenant}",
          environment: "{environment}",
          companyId: "{companyId}",
          documentType: args.documentType,
          documentNumber: args.documentNumber,
        },
        queryParams: {},
        body: null,
        description: "Lookup an exported document marker.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes:
          "404 means the doc has not been marked exported. documentType is case-sensitive — match the doc-type string exactly.",
      };
    },
  },
  {
    name: "trimit_exported_create",
    description:
      "Mark a document as exported. After this, subsequent GET /salesDocuments calls will exclude the doc (until it is un-marked).",
    category: CATEGORY,
    zodShape: {
      type: z.enum(DOC_TYPES),
      number: z.string(),
    },
    handler: (args: { type: (typeof DOC_TYPES)[number]; number: string }) => {
      const endpoint = `${trimitBase()}/exportedDocuments`;
      const body = { type: args.type, number: args.number };
      return {
        endpoint,
        method: "POST",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: {},
        body,
        description: "Mark a document exported.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "POST", body),
        auth: TRIMIT_AUTH,
        notes:
          "One call per document — there is no batch variant. Idempotent: re-marking an already-exported doc returns the existing record.",
      };
    },
  },
  {
    name: "trimit_exported_delete",
    description: "Un-mark exported (error recovery — re-includes the doc in future polls). Returns 204.",
    category: CATEGORY,
    zodShape: {
      documentType: z.enum(DOC_TYPES),
      documentNumber: z.string(),
    },
    handler: (args: { documentType: (typeof DOC_TYPES)[number]; documentNumber: string }) => {
      const endpoint = `${trimitBase()}/exportedDocuments('${encodeURIComponent(args.documentType)}','${encodeURIComponent(args.documentNumber)}')`;
      return {
        endpoint,
        method: "DELETE",
        headers: buildHeaders(),
        pathParams: {
          tenant: "{tenant}",
          environment: "{environment}",
          companyId: "{companyId}",
          documentType: args.documentType,
          documentNumber: args.documentNumber,
        },
        queryParams: {},
        body: null,
        description: "Delete an exported-document marker.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "DELETE", null),
        auth: TRIMIT_AUTH,
        notes: "204 No Content on success. Use to re-import a doc you previously marked exported by mistake.",
      };
    },
  },
];
