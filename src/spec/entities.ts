import type { Entity } from "./types.js";

// Field flags:
//   required  — must be present on POST create
//   mutable   — patchable after create
//   readOnly  — server-set, never send
//   decimal   — send/receive as JSON string when IEEE754Compatible: true
//   enumRef   — see enums.ts
//   itemEntity — child entity for arrays

export const ENTITIES: Record<string, Entity> = {
  customer: {
    name: "customer",
    resourcePath: "customers",
    category: "customers",
    apiBase: "trimit",
    keys: ["systemId"],
    defaultExpand: [
      "picture",
      "defaultDimensions",
      "priceGroupParameters",
      "contactsInformation",
      "customerFinancialDetail",
      "configuredFields",
    ],
    fields: [
      { name: "systemId", type: "guid", primaryKey: true, readOnly: true, description: "BC SystemId GUID — use in URL path for PATCH/DELETE." },
      { name: "number", type: "string", required: true, mutable: false, description: "Customer number. Unique. 409 if duplicate on POST." },
      { name: "displayName", type: "string", required: true, mutable: true },
      { name: "type", type: "enum", enumRef: "customerType", required: true, mutable: true },
      { name: "addressLine1", type: "string", required: true, mutable: true },
      { name: "addressLine2", type: "string", mutable: true },
      { name: "city", type: "string", required: true, mutable: true },
      { name: "state", type: "string", mutable: true },
      { name: "country", type: "string", required: true, mutable: true, description: "ISO country/region code." },
      { name: "postalCode", type: "string", required: true, mutable: true },
      { name: "email", type: "string", required: true, mutable: true },
      { name: "phoneNumber", type: "string", mutable: true },
      { name: "website", type: "string", mutable: true },
      { name: "salespersonCode", type: "string", mutable: true },
      { name: "salespersonCode2", type: "string", mutable: true },
      { name: "salespersonCode3", type: "string", mutable: true },
      { name: "creditLimit", type: "decimal", decimal: true, mutable: true },
      { name: "blocked", type: "enum", enumRef: "customerBlocked", mutable: true },
      { name: "chain", type: "string", mutable: true },
      { name: "companyGroup", type: "string", mutable: true },
      { name: "selltoGroup", type: "string", mutable: true },
      { name: "selltoType", type: "string", mutable: true },
      { name: "commissionGroup", type: "string", mutable: true },
      { name: "bonusGroup", type: "string", mutable: true },
      { name: "allocationPriority", type: "integer", mutable: true },
      { name: "lastDateModified", type: "datetime", readOnly: true, description: "Incremental sync cursor." },
      { name: "additionalFields", type: "array", itemEntity: "additionalField", mutable: true, description: "Replacement set on PATCH — sending replaces all rows." },
    ],
    navigationProperties: [
      { name: "picture", target: "picture", multiplicity: "one" },
      { name: "defaultDimensions", target: "dimensionAssignment", multiplicity: "many" },
      { name: "priceGroupParameters", target: "priceGroupParameter", multiplicity: "many" },
      { name: "contactsInformation", target: "contactInformation", multiplicity: "many" },
      { name: "customerFinancialDetail", target: "customerFinancialDetail", multiplicity: "one" },
      { name: "configuredFields", target: "configuredField", multiplicity: "many" },
      { name: "additionalFields", target: "additionalField", multiplicity: "many" },
    ],
  },

  additionalField: {
    name: "additionalField",
    resourcePath: "additionalFields",
    category: "customers",
    apiBase: "trimit",
    keys: ["name"],
    fields: [
      { name: "number", type: "string", description: "Parent doc/customer number — present on line-level additionalFields." },
      { name: "name", type: "string", required: true, primaryKey: true },
      { name: "value", type: "string", required: true },
    ],
    navigationProperties: [],
    notes: "Maps to BC configuredFields table. Customer + sales doc header use {name,value}; lines use {number?,name,value}.",
  },

  salesDocument: {
    name: "salesDocument",
    resourcePath: "salesDocuments",
    category: "salesdocs",
    apiBase: "trimit",
    keys: ["systemId"],
    defaultExpand: ["salesDocumentLines($expand=additionalFields)", "additionalFields"],
    fields: [
      { name: "systemId", type: "guid", primaryKey: true, readOnly: true },
      { name: "docType", type: "enum", enumRef: "docType", required: true, description: "Case-sensitive. 'Order' not 'order'." },
      { name: "docNo", type: "string", required: true, description: "Customer-facing doc number — unique per docType." },
      { name: "sellToCustomerNo", type: "string", required: true, description: "BC customer number, e.g. '10000'." },
      { name: "SellToCustomerName", type: "string", description: "Note capitalization — server returns SellTo* with capital S." },
      { name: "sellToEmail", type: "string" },
      { name: "selltoPhoneNo", type: "string" },
      { name: "orderDate", type: "date", required: true, description: "YYYY-MM-DD." },
      { name: "releaseDocument", type: "boolean", description: "true = release in BC on create." },
      { name: "processedDate", type: "datetime", readOnly: true, description: "Set by BC when import journal row is processed." },
      { name: "lastDateModified", type: "datetime", readOnly: true },
      { name: "salesDocumentLines", type: "array", itemEntity: "salesDocumentLine", required: true },
      { name: "additionalFields", type: "array", itemEntity: "additionalField" },
    ],
    navigationProperties: [
      { name: "salesDocumentLines", target: "salesDocumentLine", multiplicity: "many" },
      { name: "additionalFields", target: "additionalField", multiplicity: "many" },
    ],
    notes:
      "POST /salesDocuments writes to TRIMIT Sales Import Journal. processedDate set by BC when imported. GET /salesDocuments() returns processed rows. Use exportedDocuments markers to exclude from future polls.",
  },

  salesDocumentLine: {
    name: "salesDocumentLine",
    resourcePath: "salesDocumentLines",
    category: "salesdocs",
    apiBase: "trimit",
    keys: ["lineNo"],
    fields: [
      { name: "lineNo", type: "integer", description: "Required when appending lines via add-fields call; auto-assigned on create." },
      { name: "type", type: "enum", enumRef: "salesLineType", required: true },
      { name: "no", type: "string", required: true, description: "Item number / G/L account / etc." },
      { name: "unitPrice", type: "decimal", decimal: true, required: true },
      { name: "quantity", type: "decimal", decimal: true, required: true },
      { name: "unitOfMeasureCode", type: "string" },
      { name: "locationCode", type: "string" },
      { name: "periodCode", type: "string" },
      { name: "discountAmount", type: "decimal", decimal: true },
      { name: "additionalFields", type: "array", itemEntity: "additionalField" },
    ],
    navigationProperties: [
      { name: "additionalFields", target: "additionalField", multiplicity: "many" },
    ],
  },

  salesReturnOrder: {
    name: "salesReturnOrder",
    resourcePath: "salesReturnOrders",
    category: "salesdocs",
    apiBase: "trimit",
    keys: ["systemId"],
    defaultExpand: ["salesReturnOrderLines($expand=additionalFields)", "additionalFields"],
    fields: [
      { name: "systemId", type: "guid", primaryKey: true, readOnly: true },
      { name: "returnOrderNo", type: "string", required: true },
      { name: "sellToCustomerNo", type: "string" },
      { name: "SellToCustomerName", type: "string" },
      { name: "sellToEmail", type: "string" },
      { name: "selltoPhoneNo", type: "string" },
      { name: "orderDate", type: "date", required: true, description: "YYYY-MM-DD." },
      { name: "releaseDocument", type: "boolean" },
      { name: "salesReturnOrderLines", type: "array", itemEntity: "salesDocumentLine", required: true },
      { name: "additionalFields", type: "array", itemEntity: "additionalField" },
    ],
    navigationProperties: [
      { name: "salesReturnOrderLines", target: "salesDocumentLine", multiplicity: "many" },
      { name: "additionalFields", target: "additionalField", multiplicity: "many" },
    ],
    notes: "Only return orders created via API are visible in /salesReturnOrders. BC-client-created return orders are not surfaced.",
  },

  exportedDocument: {
    name: "exportedDocument",
    resourcePath: "exportedDocuments",
    category: "exported",
    apiBase: "trimit",
    keys: ["type", "number"],
    fields: [
      { name: "type", type: "enum", enumRef: "exportedDocumentType", required: true, primaryKey: true, description: "Case-sensitive." },
      { name: "number", type: "string", required: true, primaryKey: true },
    ],
    navigationProperties: [],
    notes:
      "POST body uses {type,number}. GET/DELETE path: exportedDocuments('Order','SO1001') — order matches keys[]. Marker, not state — does not change BC.",
  },

  master: {
    name: "master",
    resourcePath: "masters",
    category: "products",
    apiBase: "trimit",
    keys: ["systemId"],
    defaultExpand: [
      "masterDescriptions",
      "masterDefDims",
      "masterAttributes",
      "masterStatGroups",
      "masterVarDims",
      "masterCollections",
      "masterCompositions",
      "masterAddInfos",
      "masterCarelabels",
      "masterAddTags",
      "masterSustainabilities",
      "masterMeasureCharts",
      "masterItems",
      "masterInventories",
      "masterImages",
      "masterPrices",
      "masterChoicelists",
      "configuredFields",
    ],
    fields: [
      { name: "systemId", type: "guid", primaryKey: true, readOnly: true },
      { name: "number", type: "string", description: "Master code." },
      { name: "noSystem", type: "string", description: "SKU template." },
      { name: "lastDateModified", type: "datetime", readOnly: true },
    ],
    navigationProperties: [
      { name: "masterItems", target: "item", multiplicity: "many" },
      { name: "masterDescriptions", target: "masterDescription", multiplicity: "many" },
      { name: "masterDefDims", target: "dimensionAssignment", multiplicity: "many" },
      { name: "masterAttributes", target: "itemAttribute", multiplicity: "many" },
      { name: "masterCollections", target: "collection", multiplicity: "many" },
      { name: "masterImages", target: "masterImage", multiplicity: "many" },
      { name: "masterPrices", target: "price", multiplicity: "many" },
      { name: "configuredFields", target: "configuredField", multiplicity: "many" },
    ],
    notes: "Heavy payload — narrow with $select and trimmed $expand for production traffic.",
  },

  item: {
    name: "item",
    resourcePath: "items",
    category: "products",
    apiBase: "trimit",
    keys: ["systemId"],
    defaultExpand: [
      "unitOfMeasure",
      "extendedDescriptions",
      "defaultDimensions",
      "attributes",
      "itemStatGroups",
      "picture",
      "itemCompositions",
      "itemAddInfos",
      "itemCarelabels",
      "itemAddTags",
      "itemSustainabilities",
      "itemInventories",
      "itemPrices",
      "configuredFields",
    ],
    fields: [
      { name: "systemId", type: "guid", primaryKey: true, readOnly: true },
      { name: "number", type: "string", description: "Item/SKU number." },
      { name: "description", type: "string" },
      { name: "lastDateModified", type: "datetime", readOnly: true },
    ],
    navigationProperties: [
      { name: "unitOfMeasure", target: "unitOfMeasure", multiplicity: "one" },
      { name: "defaultDimensions", target: "dimensionAssignment", multiplicity: "many" },
      { name: "attributes", target: "itemAttribute", multiplicity: "many" },
      { name: "itemPrices", target: "price", multiplicity: "many" },
      { name: "configuredFields", target: "configuredField", multiplicity: "many" },
    ],
    notes: "TRIMIT-enriched item. Different resource from standard /api/v2.0/.../items.",
  },

  product: {
    name: "product",
    resourcePath: "products",
    category: "products",
    apiBase: "trimit",
    keys: ["systemId"],
    fields: [
      { name: "systemId", type: "guid", primaryKey: true, readOnly: true },
      { name: "number", type: "string" },
      { name: "lastDateModified", type: "datetime", readOnly: true, description: "Filter on this for delta sync." },
    ],
    navigationProperties: [],
    notes: "Curated feed driven by configured BC categories.",
  },

  campaign: {
    name: "campaign",
    resourcePath: "campaigns",
    category: "masterdata",
    apiBase: "trimit",
    keys: ["systemId"],
    defaultExpand: ["defaultDimensions", "priceGroupParameters"],
    fields: [
      { name: "systemId", type: "guid", primaryKey: true, readOnly: true },
      { name: "number", type: "string" },
      { name: "description", type: "string" },
      { name: "salespersonCode", type: "string" },
      { name: "statusCode", type: "string" },
      { name: "startingDate", type: "date" },
      { name: "endingDate", type: "date" },
      { name: "activated", type: "boolean" },
      { name: "lastDateModified", type: "datetime", readOnly: true },
    ],
    navigationProperties: [
      { name: "defaultDimensions", target: "dimensionAssignment", multiplicity: "many" },
      { name: "priceGroupParameters", target: "priceGroupParameter", multiplicity: "many" },
    ],
  },

  inventory: {
    name: "inventory",
    resourcePath: "inventories",
    category: "inventory",
    apiBase: "trimit",
    keys: ["itemNo", "locationCode"],
    fields: [
      { name: "itemNo", type: "string", primaryKey: true },
      { name: "locationCode", type: "string", primaryKey: true },
      { name: "quantity", type: "decimal", decimal: true },
      { name: "futureDelivers", type: "decimal", decimal: true, description: "Pre-order stock when TRIMIT 'Export Future Delivers' is enabled." },
    ],
    navigationProperties: [],
    notes: "Use Data-Access-Intent: ReadOnly for heavy polling.",
  },

  location: {
    name: "location",
    resourcePath: "locations",
    category: "inventory",
    apiBase: "trimit",
    keys: ["code"],
    fields: [
      { name: "code", type: "string", primaryKey: true },
      { name: "name", type: "string" },
      { name: "addressLine1", type: "string" },
      { name: "city", type: "string" },
      { name: "country", type: "string" },
    ],
    navigationProperties: [],
  },

  contact: {
    name: "contact",
    resourcePath: "contacts",
    category: "customers",
    apiBase: "trimit",
    keys: ["systemId"],
    defaultExpand: ["picture"],
    fields: [
      { name: "systemId", type: "guid", primaryKey: true, readOnly: true },
      { name: "companyName", type: "string" },
      { name: "addressLine1", type: "string" },
      { name: "addressLine2", type: "string" },
      { name: "city", type: "string" },
      { name: "salespersonCode", type: "string" },
      { name: "phoneNo", type: "string" },
      { name: "email", type: "string" },
    ],
    navigationProperties: [{ name: "picture", target: "picture", multiplicity: "one" }],
  },

  salesperson: {
    name: "salesperson",
    resourcePath: "salespersons",
    category: "customers",
    apiBase: "trimit",
    keys: ["code"],
    fields: [
      { name: "code", type: "string", primaryKey: true },
      { name: "name", type: "string" },
      { name: "email", type: "string" },
      { name: "phoneNo", type: "string" },
      { name: "commissionPercent", type: "decimal", decimal: true },
      { name: "globalDimension1Code", type: "string" },
      { name: "globalDimension2Code", type: "string" },
    ],
    navigationProperties: [],
  },

  postedSalesInvoice: {
    name: "postedSalesInvoice",
    resourcePath: "postedSalesInvoices",
    category: "postedsales",
    apiBase: "trimit",
    keys: ["systemId"],
    defaultExpand: ["postedSalesInvoiceLines", "trackingLines"],
    fields: [
      { name: "systemId", type: "guid", primaryKey: true, readOnly: true },
      { name: "number", type: "string" },
      { name: "customerNo", type: "string" },
      { name: "postingDate", type: "date" },
      { name: "totalAmount", type: "decimal", decimal: true },
    ],
    navigationProperties: [
      { name: "postedSalesInvoiceLines", target: "postedSalesInvoiceLine", multiplicity: "many" },
      { name: "trackingLines", target: "trackingLine", multiplicity: "many" },
    ],
  },

  postedSalesShipment: {
    name: "postedSalesShipment",
    resourcePath: "postedSalesShipments",
    category: "postedsales",
    apiBase: "trimit",
    keys: ["systemId"],
    defaultExpand: ["postedSalesShipmentLines", "trackingLines"],
    fields: [
      { name: "systemId", type: "guid", primaryKey: true, readOnly: true },
      { name: "number", type: "string" },
      { name: "customerNo", type: "string" },
      { name: "postingDate", type: "date" },
    ],
    navigationProperties: [
      { name: "postedSalesShipmentLines", target: "postedSalesShipmentLine", multiplicity: "many" },
      { name: "trackingLines", target: "trackingLine", multiplicity: "many" },
    ],
  },

  dimensionAssignment: {
    name: "dimensionAssignment",
    resourcePath: "defaultDimensions",
    category: "standard",
    apiBase: "trimit",
    keys: ["parentId", "dimensionCode"],
    fields: [
      { name: "parentType", type: "enum", enumRef: "dimensionParentType", required: true },
      { name: "parentId", type: "guid", required: true },
      { name: "dimensionCode", type: "string", required: true, primaryKey: true },
      { name: "dimensionValueCode", type: "string", required: true },
    ],
    navigationProperties: [],
  },
};

export const ENTITY_NAMES = Object.keys(ENTITIES);

export function getEntity(name: string): Entity | undefined {
  return ENTITIES[name];
}

export function findEntityByResourcePath(path: string): Entity | undefined {
  return Object.values(ENTITIES).find((e) => e.resourcePath === path);
}
