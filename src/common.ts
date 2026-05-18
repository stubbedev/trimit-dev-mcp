// Shared constants and helpers for TRIMIT API tool handlers.
//
// All TRIMIT endpoints are hosted by Microsoft Dynamics 365 Business Central
// at api.businesscentral.dynamics.com. There are three logical base URLs:
//
//   trimit  → /api/trimit/integration/v1.1/companies({companyId})       (TRIMIT custom extension)
//   std     → /api/v2.0/companies({companyId})                          (Microsoft standard BC API)
//   odata   → /ODataV4                                                  (BC OData v4 endpoint)
//
// Placeholders that the caller must substitute before issuing the request:
//   {tenant}       — Azure AD / Microsoft Entra tenant GUID (OAUTH_TENANT)
//   {environment}  — BC environment name (e.g. "Production", "Sandbox")
//   {companyId}    — BC company GUID (returned by GET /companies)

export const HOST = "https://api.businesscentral.dynamics.com/v2.0";
export const TRIMIT_API_PATH = "api/trimit/integration/v1.1";
export const STD_API_PATH = "api/v2.0";

export function trimitBase(): string {
  return `${HOST}/{tenant}/{environment}/${TRIMIT_API_PATH}/companies({companyId})`;
}

export function stdBase(): string {
  return `${HOST}/{tenant}/{environment}/${STD_API_PATH}/companies({companyId})`;
}

export function stdRoot(): string {
  return `${HOST}/{tenant}/{environment}/${STD_API_PATH}`;
}

export function odataBase(): string {
  return `${HOST}/{tenant}/{environment}/ODataV4`;
}

export function tenantRoot(): string {
  return `${HOST}/{tenant}/{environment}`;
}

export interface OdataQuery {
  filter?: string;
  select?: string[];
  expand?: string;
  top?: number;
  skip?: number;
  orderby?: string;
  count?: boolean;
}

export function buildOdataQuery(q: OdataQuery): {
  qs: string;
  params: Record<string, string>;
} {
  const params: Record<string, string> = {};
  const segments: string[] = [];
  if (q.filter) {
    params["$filter"] = q.filter;
    segments.push(`$filter=${encodeURIComponent(q.filter)}`);
  }
  if (q.select?.length) {
    const v = q.select.join(",");
    params["$select"] = v;
    segments.push(`$select=${v}`);
  }
  if (q.expand) {
    params["$expand"] = q.expand;
    segments.push(`$expand=${encodeURIComponent(q.expand)}`);
  }
  if (q.top !== undefined) {
    params["$top"] = String(q.top);
    segments.push(`$top=${q.top}`);
  }
  if (q.skip !== undefined) {
    params["$skip"] = String(q.skip);
    segments.push(`$skip=${q.skip}`);
  }
  if (q.orderby) {
    params["$orderby"] = q.orderby;
    segments.push(`$orderby=${encodeURIComponent(q.orderby)}`);
  }
  if (q.count !== undefined) {
    params["$count"] = String(q.count);
    segments.push(`$count=${q.count}`);
  }
  return { qs: segments.length ? `?${segments.join("&")}` : "", params };
}

export function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: "Bearer {token}",
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(extra ?? {}),
  };
}

export const TRIMIT_AUTH = {
  type: "OAuth 2.0 — Microsoft Entra (Azure AD) client credentials",
  tokenEndpoint: "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
  scope: "https://api.businesscentral.dynamics.com/.default",
  notes:
    "Customer-tenant Entra app registration with Business Central / TRIMIT integration consent. Send bearer token in Authorization header.",
} as const;

export function fetchExample(
  endpoint: string,
  method: string,
  body: unknown,
  extraHeaders?: Record<string, string>
): string {
  const headers: Record<string, string> = {
    Authorization: "Bearer {token}",
    ...(body !== null && body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(extraHeaders ?? {}),
  };
  const headerLines = JSON.stringify(headers);
  if (body === null || body === undefined) {
    return `const response = await fetch('${endpoint}', {\n  method: '${method}',\n  headers: ${headerLines}\n});\nconst data = await response.json();`;
  }
  return `const response = await fetch('${endpoint}', {\n  method: '${method}',\n  headers: ${headerLines},\n  body: JSON.stringify(${JSON.stringify(body, null, 2)})\n});\nconst data = await response.json();`;
}
