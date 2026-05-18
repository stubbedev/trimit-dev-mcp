import type { EnumDef } from "./types.js";

export const ENUMS: Record<string, EnumDef> = {
  docType: {
    name: "docType",
    values: ["Quote", "Order", "Invoice", "Credit Memo", "Blanket Order", "Return Order"],
    caseSensitive: true,
    description: "Sales document type for /salesDocuments POST. Case-sensitive.",
  },
  exportedDocumentType: {
    name: "exportedDocumentType",
    values: [
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
    ],
    caseSensitive: true,
    description: "Type values accepted by /exportedDocuments. Posted-* variants only valid here, not in /salesDocuments.",
  },
  customerType: {
    name: "customerType",
    values: ["Company", "Person"],
    caseSensitive: true,
    description: "Customer.type field.",
  },
  customerBlocked: {
    name: "customerBlocked",
    values: [" ", "Ship", "Invoice", "All"],
    caseSensitive: true,
    description: "Customer.blocked field. Space ' ' = not blocked. Case-sensitive.",
  },
  salesLineType: {
    name: "salesLineType",
    values: ["Item", "G/L Account", "Resource", "Fixed Asset", "Charge (Item)", "Comment"],
    caseSensitive: true,
    description: "Sales document line type. Case-sensitive — 'item' will fail.",
  },
  dimensionParentType: {
    name: "dimensionParentType",
    values: ["Customer", "Vendor", "Item", "Employee", "Resource", "G/L Account", "Bank Account", "Fixed Asset"],
    caseSensitive: true,
    description: "defaultDimensions[].parentType.",
  },
  batchMethod: {
    name: "batchMethod",
    values: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    caseSensitive: true,
    description: "HTTP method inside /$batch sub-requests. Uppercase.",
  },
};
