import { ToolDefinition } from "../registry.js";
import { HOST, TRIMIT_API_PATH, TRIMIT_AUTH, buildHeaders, fetchExample } from "../common.js";

const CATEGORY = "metadata";

export const metadataTools: ToolDefinition[] = [
  {
    name: "trimit_metadata_get",
    description:
      "Get the CSDL/EDMX $metadata document for the TRIMIT Integration API (v1.1). Use for client codegen.",
    category: CATEGORY,
    zodShape: {},
    handler: () => {
      const endpoint = `${HOST}/{tenant}/{environment}/${TRIMIT_API_PATH}/$metadata`;
      const extra = { Accept: "application/xml" };
      return {
        endpoint,
        method: "GET",
        headers: buildHeaders(extra),
        pathParams: { tenant: "{tenant}", environment: "{environment}" },
        queryParams: {},
        body: null,
        description: "TRIMIT $metadata — XML EDMX schema for the integration API.",
        docsUrl: "https://apidocs.trimit.com/",
        codeExample: fetchExample(endpoint, "GET", null, extra),
        auth: TRIMIT_AUTH,
        notes:
          "Different document from the BC standard /api/v2.0/$metadata — this one lists only TRIMIT entities.",
      };
    },
  },
];
