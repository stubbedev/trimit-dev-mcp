import { ENTITIES, findEntityByResourcePath, getEntity } from "./entities.js";
import { ENUMS } from "./enums.js";
import { checkOdata } from "./odata.js";
import type { Entity, Field } from "./types.js";

export type Severity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: Severity;
  code: string;
  path?: string;
  message: string;
  fix?: string;
}

export interface ValidateRequestInput {
  endpoint: string;
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
}

interface ParsedEndpoint {
  apiBase: "trimit" | "std" | "odata" | "unknown";
  resource?: string;
  keyExpr?: string;
  query: Record<string, string>;
  rawQuery: string;
}

function parseEndpoint(endpoint: string): ParsedEndpoint {
  const [pathPart, queryPart = ""] = endpoint.split("?");
  const query: Record<string, string> = {};
  for (const pair of queryPart.split("&").filter(Boolean)) {
    const idx = pair.indexOf("=");
    const k = idx >= 0 ? pair.slice(0, idx) : pair;
    const v = idx >= 0 ? decodeURIComponent(pair.slice(idx + 1)) : "";
    query[k] = v;
  }

  let apiBase: ParsedEndpoint["apiBase"] = "unknown";
  if (/\/api\/trimit\/integration\/v1\.\d+\//.test(pathPart)) apiBase = "trimit";
  else if (/\/api\/v2\.0\//.test(pathPart)) apiBase = "std";
  else if (/\/ODataV4(\/|$)/.test(pathPart)) apiBase = "odata";

  // Resource segment after companies({id})/ or after the apiBase path
  const compMatch = pathPart.match(/companies\(([^)]*)\)\/([^/(?]+)(\(([^)]+)\))?/);
  const altMatch = pathPart.match(/\/(?:api\/v2\.0|api\/trimit\/integration\/v1\.\d+|ODataV4)\/([^/(?]+)(\(([^)]+)\))?$/);
  const resource = compMatch?.[2] ?? altMatch?.[1];
  const keyExpr = compMatch?.[4] ?? altMatch?.[3];

  return { apiBase, resource, keyExpr, query, rawQuery: queryPart };
}

function headerLookup(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

function bodyHasDecimalField(body: unknown, entity: Entity | undefined): string[] {
  if (!entity || !body || typeof body !== "object") return [];
  const obj = body as Record<string, unknown>;
  const out: string[] = [];
  for (const f of entity.fields) {
    if (!f.decimal) continue;
    if (f.name in obj) out.push(f.name);
  }
  return out;
}

function validateBodyAgainstEntity(
  body: Record<string, unknown>,
  entity: Entity,
  mode: "create" | "patch",
  pathPrefix = ""
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fieldMap = new Map<string, Field>();
  for (const f of entity.fields) fieldMap.set(f.name, f);
  for (const nav of entity.navigationProperties) {
    if (!fieldMap.has(nav.name)) {
      fieldMap.set(nav.name, { name: nav.name, type: "array", itemEntity: nav.target });
    }
  }

  if (mode === "create") {
    for (const f of entity.fields) {
      if (f.required && !(f.name in body)) {
        issues.push({
          severity: "error",
          code: "body.missing-required",
          path: `${pathPrefix}${f.name}`,
          message: `Field '${f.name}' is required on ${entity.name} create.`,
        });
      }
    }
  }

  for (const [key, value] of Object.entries(body)) {
    const field = fieldMap.get(key);
    if (!field) {
      issues.push({
        severity: "warning",
        code: "body.unknown-field",
        path: `${pathPrefix}${key}`,
        message: `Field '${key}' is not declared on entity '${entity.name}'. Possible typo or undocumented configuredField — verify against $metadata.`,
      });
      continue;
    }
    if (field.readOnly) {
      issues.push({
        severity: "warning",
        code: "body.readonly-write",
        path: `${pathPrefix}${key}`,
        message: `Field '${key}' is server-set (readOnly). Sending it will likely be ignored or rejected.`,
      });
    }
    if (mode === "patch" && field.mutable === false) {
      issues.push({
        severity: "error",
        code: "body.immutable",
        path: `${pathPrefix}${key}`,
        message: `Field '${key}' is not mutable — cannot PATCH.`,
      });
    }
    issues.push(...checkFieldValue(field, value, `${pathPrefix}${key}`));
  }
  return issues;
}

function checkFieldValue(field: Field, value: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (value === null || value === undefined) return issues;

  if (field.enumRef) {
    const e = ENUMS[field.enumRef];
    if (e && typeof value === "string") {
      if (e.caseSensitive) {
        if (!e.values.includes(value)) {
          const ciHit = e.values.find((v) => v.toLowerCase() === value.toLowerCase());
          issues.push({
            severity: "error",
            code: "body.bad-enum",
            path,
            message: `Value '${value}' not in enum ${field.enumRef}. Allowed: ${e.values.map((v) => `'${v}'`).join(", ")}.`,
            fix: ciHit ? `Use exact casing: '${ciHit}'.` : undefined,
          });
        }
      } else if (!e.values.map((v) => v.toLowerCase()).includes(value.toLowerCase())) {
        issues.push({
          severity: "error",
          code: "body.bad-enum",
          path,
          message: `Value '${value}' not in enum ${field.enumRef}.`,
        });
      }
    }
    return issues;
  }

  switch (field.type) {
    case "string":
      if (typeof value !== "string") {
        issues.push({ severity: "error", code: "body.type", path, message: `Expected string, got ${typeof value}.` });
      }
      break;
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        issues.push({ severity: "error", code: "body.type", path, message: `Expected integer.` });
      }
      break;
    case "number":
      if (typeof value !== "number") {
        issues.push({ severity: "error", code: "body.type", path, message: `Expected number.` });
      }
      break;
    case "decimal":
      if (typeof value !== "number" && typeof value !== "string") {
        issues.push({
          severity: "error",
          code: "body.type",
          path,
          message: `Decimal must be number or string (when IEEE754Compatible:true).`,
        });
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        issues.push({ severity: "error", code: "body.type", path, message: `Expected boolean.` });
      }
      break;
    case "date":
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        issues.push({
          severity: "error",
          code: "body.bad-date",
          path,
          message: `Expected date YYYY-MM-DD, got '${String(value)}'.`,
        });
      }
      break;
    case "datetime":
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        issues.push({
          severity: "warning",
          code: "body.bad-datetime",
          path,
          message: `Expected ISO 8601 datetime with 'T'.`,
        });
      }
      break;
    case "guid":
      if (typeof value !== "string" || !/^[0-9a-fA-F-]{36}$/.test(value)) {
        issues.push({ severity: "warning", code: "body.bad-guid", path, message: `Expected GUID.` });
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        issues.push({ severity: "error", code: "body.type", path, message: `Expected array.` });
      } else if (field.itemEntity) {
        const childEntity = getEntity(field.itemEntity);
        if (childEntity) {
          value.forEach((item, idx) => {
            if (item && typeof item === "object") {
              issues.push(
                ...validateBodyAgainstEntity(item as Record<string, unknown>, childEntity, "create", `${path}[${idx}].`)
              );
            }
          });
        }
      }
      break;
  }
  return issues;
}

export function validateRequest(input: ValidateRequestInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const parsed = parseEndpoint(input.endpoint);

  if (parsed.apiBase === "unknown") {
    issues.push({
      severity: "warning",
      code: "endpoint.base",
      message:
        "Endpoint does not match a known TRIMIT / BC base. Expected /api/trimit/integration/v1.x, /api/v2.0, or /ODataV4.",
    });
  }

  // Placeholder substitution
  for (const placeholder of ["{tenant}", "{environment}", "{companyId}", "{token}"]) {
    if (placeholder !== "{token}" && input.endpoint.includes(placeholder)) {
      issues.push({
        severity: "info",
        code: "endpoint.placeholder",
        message: `Endpoint still contains ${placeholder} — substitute before issuing the request.`,
      });
    }
  }
  if (headerLookup(input.headers, "Authorization")?.includes("{token}")) {
    issues.push({
      severity: "info",
      code: "headers.token-placeholder",
      message: "Authorization header still contains {token} placeholder.",
    });
  }

  // Method-specific header checks
  const ifMatch = headerLookup(input.headers, "If-Match");
  const ieee = headerLookup(input.headers, "IEEE754Compatible");
  const contentType = headerLookup(input.headers, "Content-Type");

  if (input.method === "PATCH" || input.method === "DELETE") {
    if (!ifMatch) {
      issues.push({
        severity: "error",
        code: "headers.missing-if-match",
        message: `BC OData requires If-Match on ${input.method}.`,
        fix: "Add header `If-Match: *` (unconditional) or pass the @odata.etag value from a prior GET.",
      });
    }
  }

  if ((input.method === "POST" || input.method === "PATCH" || input.method === "PUT") && input.body !== undefined) {
    if (!contentType) {
      issues.push({
        severity: "error",
        code: "headers.missing-content-type",
        message: "Body present without Content-Type header.",
        fix: "Add `Content-Type: application/json`.",
      });
    } else if (!/application\/json/i.test(contentType)) {
      issues.push({
        severity: "warning",
        code: "headers.unexpected-content-type",
        message: `Content-Type is '${contentType}'. BC OData expects application/json.`,
      });
    }
  }

  if (!headerLookup(input.headers, "Authorization")) {
    issues.push({
      severity: "error",
      code: "headers.missing-auth",
      message: "Missing Authorization header. Send `Authorization: Bearer {token}`.",
    });
  }

  // Resolve entity
  const entity: Entity | undefined = parsed.resource ? findEntityByResourcePath(parsed.resource) : undefined;

  // Check $batch
  if (parsed.resource === "$batch") {
    if (input.method !== "POST") {
      issues.push({
        severity: "error",
        code: "batch.method",
        message: "$batch requires POST.",
      });
    }
    if (input.body && typeof input.body === "object") {
      const requests = (input.body as { requests?: unknown }).requests;
      if (!Array.isArray(requests)) {
        issues.push({
          severity: "error",
          code: "batch.no-requests",
          message: "$batch body must contain `requests: []`.",
        });
      } else {
        requests.forEach((req: unknown, idx: number) => {
          if (!req || typeof req !== "object") return;
          const r = req as Record<string, unknown>;
          if (!r.id) {
            issues.push({
              severity: "error",
              code: "batch.missing-id",
              path: `requests[${idx}]`,
              message: "Each sub-request needs a unique 'id'.",
            });
          }
          if (typeof r.url !== "string") {
            issues.push({
              severity: "error",
              code: "batch.missing-url",
              path: `requests[${idx}]`,
              message: "Each sub-request needs a relative 'url'.",
            });
          } else if (/^https?:/.test(r.url) || r.url.startsWith("/")) {
            issues.push({
              severity: "warning",
              code: "batch.absolute-url",
              path: `requests[${idx}].url`,
              message: "Sub-request URLs should be relative to the batch base, not absolute.",
            });
          }
          if (typeof r.method === "string" && ["POST", "PATCH", "PUT"].includes(r.method) && r.body !== undefined) {
            const subHeaders = r.headers as Record<string, string> | undefined;
            if (!subHeaders || !Object.keys(subHeaders).some((k) => k.toLowerCase() === "content-type")) {
              issues.push({
                severity: "warning",
                code: "batch.sub-missing-content-type",
                path: `requests[${idx}].headers`,
                message: "Sub-request with body should set Content-Type: application/json.",
              });
            }
          }
        });
      }
    }
  }

  // Validate body fields against entity schema
  if (entity && input.body && typeof input.body === "object" && !Array.isArray(input.body)) {
    const mode: "create" | "patch" = input.method === "POST" ? "create" : "patch";
    if (input.method === "POST" || input.method === "PATCH") {
      issues.push(...validateBodyAgainstEntity(input.body as Record<string, unknown>, entity, mode));
    }
    const decimalFieldsInBody = bodyHasDecimalField(input.body, entity);
    if (decimalFieldsInBody.length && ieee?.toLowerCase() !== "true") {
      issues.push({
        severity: "warning",
        code: "headers.missing-ieee754",
        message: `Body includes decimal fields (${decimalFieldsInBody.join(", ")}) without IEEE754Compatible: true. JS numbers can lose precision on large/high-scale decimals — BC convention is to send/receive these as strings.`,
        fix: "Add header `IEEE754Compatible: true` and send decimals as JSON strings ('123.45').",
      });
    }
  }

  // OData query check
  if (parsed.query["$filter"] || parsed.query["$select"] || parsed.query["$expand"] || parsed.query["$orderby"] || parsed.query["$top"] || parsed.query["$skip"]) {
    const odataIssues = checkOdata({
      entity: entity?.name,
      resourcePath: parsed.resource,
      filter: parsed.query["$filter"],
      select: parsed.query["$select"]?.split(",").map((s) => s.trim()),
      expand: parsed.query["$expand"],
      orderby: parsed.query["$orderby"],
      top: parsed.query["$top"] ? Number(parsed.query["$top"]) : undefined,
      skip: parsed.query["$skip"] ? Number(parsed.query["$skip"]) : undefined,
    });
    for (const i of odataIssues) {
      issues.push({ severity: i.severity, code: i.code, message: i.message });
    }
  }

  return issues;
}

export function listEntities(): string[] {
  return Object.keys(ENTITIES);
}
