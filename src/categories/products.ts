import { z } from "zod";
import { ToolDefinition } from "../registry.js";
import { TRIMIT_AUTH, buildHeaders, buildOdataQuery, fetchExample, trimitBase } from "../common.js";

const CATEGORY = "products";

const MASTERS_DEFAULT_EXPAND = [
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
].join(",");

const ITEMS_DEFAULT_EXPAND = [
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
].join(",");

const PRODUCTS_DEFAULT_EXPAND = [
  "productDescriptions",
  "productDefDims",
  "productAttributes",
  "productStatGroups",
  "productVarDims",
  "productCollections",
  "productCompositions",
  "productAddInfos",
  "productCarelabels",
  "productAddTags",
  "productSustainabilities",
  "productMeasureCharts",
  "productItems",
  "productPrices",
  "configuredFields",
].join(",");

export const productsTools: ToolDefinition[] = [
  {
    name: "trimit_products_get_masters",
    description:
      "List TRIMIT Masters (style/master products). Wide $expand by default — covers descriptions, dimensions, attributes, statistics groups, variants, collections, compositions, additional info, care labels, tags, sustainabilities, measure charts, items, inventories, images, prices, choicelists, and configuredFields.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z.string().optional().describe(`Default expand: ${MASTERS_DEFAULT_EXPAND}`),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? MASTERS_DEFAULT_EXPAND;
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/masters${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "TRIMIT Masters (style headers).",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes:
          "Key fields: number (master code), noSystem (SKU template), masterItems → SKU variants. Heavy payload — narrow with $select and trimmed $expand for production traffic.",
      };
    },
  },
  {
    name: "trimit_products_get_items",
    description:
      "List TRIMIT-enriched items (SKUs) with picture, prices, attributes, compositions, inventories, configured fields, and more.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z.string().optional().describe(`Default expand: ${ITEMS_DEFAULT_EXPAND}`),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? ITEMS_DEFAULT_EXPAND;
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/items${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "TRIMIT items list with full expand.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes:
          "Different resource from /companies(...)/items in the Standard API — same name, but this one has TRIMIT extensions (variants link, sustainabilities, configuredFields).",
      };
    },
  },
  {
    name: "trimit_products_get_products",
    description:
      "Curated product list (Masters + Items from configured BC categories). Suitable for storefront sync.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      expand: z.string().optional().describe(`Default expand: ${PRODUCTS_DEFAULT_EXPAND}`),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; expand?: string; top?: number; skip?: number }) => {
      const expand = args.expand ?? PRODUCTS_DEFAULT_EXPAND;
      const { qs, params } = buildOdataQuery({ ...args, expand });
      const endpoint = `${trimitBase()}/products${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "TRIMIT Products feed.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes:
          "Filter on lastDateModified for delta sync. Configure which BC categories feed this endpoint in TRIMIT setup.",
      };
    },
  },
  {
    name: "trimit_products_get_categories",
    description: "List TRIMIT Categories used to drive the /products feed.",
    category: CATEGORY,
    zodShape: {
      filter: z.string().optional(),
      select: z.array(z.string()).optional(),
      top: z.number().optional(),
      skip: z.number().optional(),
    },
    handler: (args: { filter?: string; select?: string[]; top?: number; skip?: number }) => {
      const { qs, params } = buildOdataQuery(args);
      const endpoint = `${trimitBase()}/categories${qs}`;
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(),
        pathParams: { tenant: "{tenant}", environment: "{environment}", companyId: "{companyId}" },
        queryParams: params,
        body: null,
        description: "TRIMIT Categories.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null),
        auth: TRIMIT_AUTH,
        notes: null,
      };
    },
  },
];
