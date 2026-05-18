import { z } from "zod";
import { ToolDefinition } from "../registry.js";
import { TRIMIT_AUTH, buildHeaders, buildOdataQuery, fetchExample, trimitBase } from "../common.js";

const CATEGORY = "customers";

const CUSTOMERS_DEFAULT_EXPAND = [
  "picture",
  "defaultDimensions",
  "priceGroupParameters",
  "contactsInformation",
  "customerFinancialDetail",
  "configuredFields",
].join(",");

export const customersTools: ToolDefinition[] = [
  {
    name: "trimit_customers_list",
    description:
      "List TRIMIT-enriched customers (picture, priceGroupParameters, contactsInformation, customerFinancialDetail, defaultDimensions, configuredFields).",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z.string().optional().describe(`Default expand: ${CUSTOMERS_DEFAULT_EXPAND}`),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? CUSTOMERS_DEFAULT_EXPAND;
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/customers${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "TRIMIT customers list.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_customers_get_contacts",
    description: "List BC Contacts with picture expanded.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z.string().optional().describe("Default: 'picture'"),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? "picture";
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/contacts${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Contacts.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: "Fields: companyName, addressLine1/2, city, salespersonCode, phoneNo, email, …",
      };
    },
  },
  {
    name: "trimit_customers_get_salespersons",
    description: "List salespersons (returns {code, name, email, phoneNo, commissionPercent, globalDimension1Code, globalDimension2Code}).",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; top?: number; skip?: number }) => {
      const { qs, params } = buildOdataQuery(args);
      const endpoint = `${trimitBase()}/salespersons${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "Salespersons list.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
  {
    name: "trimit_customers_create",
    description: "Create a TRIMIT customer. 201 on success. 409 if customer number already exists.",
    category: CATEGORY,
    zodShape: {
      number: z.string().describe("Customer number (unique)"),
      displayName: z.string(),
      type: z.enum(["Company", "Person"]).describe("Case-sensitive."),
      addressLine1: z.string(),
      city: z.string(),
      country: z.string().describe("Country/region code (ISO)"),
      postalCode: z.string(),
      email: z.string(),
      phoneNumber: z.string().optional(),
      addressLine2: z.string().optional(),
      state: z.string().optional(),
      website: z.string().optional(),
      salespersonCode: z.string().optional(),
      salespersonCode2: z.string().optional(),
      salespersonCode3: z.string().optional(),
      creditLimit: z.number().optional().describe("Decimal — send as string when IEEE754Compatible: true."),
      blocked: z.enum([" ", "Ship", "Invoice", "All"]).optional().describe("Space = not blocked. Case-sensitive."),
      chain: z.string().optional(),
      companyGroup: z.string().optional(),
      selltoGroup: z.string().optional(),
      selltoType: z.string().optional(),
      commissionGroup: z.string().optional(),
      bonusGroup: z.string().optional(),
      allocationPriority: z.number().optional(),
      additionalFields: z
        .array(z.object({ name: z.string(), value: z.string() }))
        .optional()
        .describe("Custom configuredFields"),
    },
    handler: (args: Record<string, unknown>) => {
      const endpoint = `${trimitBase()}/customers`;
      const body = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));
      return {
        endpoint,
        method: "POST",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: {},
        body,
        description: "Create a new customer.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "POST", body),
        auth: TRIMIT_AUTH,
        notes:
          "201 returns the created customer with @odata.etag + systemId. 409 'EntityWithSameKeyExists' means number is taken. additionalFields targets BC configuredFields table.",
      };
    },
  },
  {
    name: "trimit_customers_patch",
    description:
      "Patch a TRIMIT customer (typically additionalFields). Sends If-Match for OData concurrency and IEEE754Compatible: true for decimal handling.",
    category: CATEGORY,
    zodShape: {
      customerId: z.string().describe("Customer systemId GUID"),
      ifMatch: z.string().default("*").describe("ETag from a prior GET, or '*' for unconditional"),
      additionalFields: z
        .array(z.object({ name: z.string(), value: z.string() }))
        .optional()
        .describe("Replacement set of additionalFields"),
      patch: z.record(z.string(), z.unknown()).optional().describe("Other fields to PATCH (e.g. { creditLimit: 5000 })"),
    },
    handler: (args: {
      customerId: string;
      ifMatch?: string;
      additionalFields?: Array<{ name: string; value: string }>;
      patch?: Record<string, unknown>;
    }) => {
      const endpoint = `${trimitBase()}/customers(${args.customerId})?$expand=additionalFields`;
      const body: Record<string, unknown> = { ...(args.patch ?? {}) };
      if (args.additionalFields) body.additionalFields = args.additionalFields;
      const extraHeaders = { "If-Match": args.ifMatch ?? "*", "IEEE754Compatible": "true" };
      return {
        endpoint,
        method: "PATCH",
        headers: buildHeaders(extraHeaders),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}", customerId: args.customerId },
        queryParams: { $expand: "additionalFields" },
        body,
        description: "Patch a customer.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "PATCH", body, extraHeaders),
        auth: TRIMIT_AUTH,
        notes:
          "If-Match: '*' bypasses optimistic concurrency. Use the @odata.etag value from a prior GET for safe concurrent updates. IEEE754Compatible: true forces decimals to be sent/received as JSON strings (BC convention) to avoid precision loss.",
      };
    },
  },
];
