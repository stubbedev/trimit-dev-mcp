import { getEntity, findEntityByResourcePath } from "./entities.js";
import type { Entity } from "./types.js";

export interface OdataIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  param?: string;
}

const FILTER_OPS = new Set([
  "eq",
  "ne",
  "gt",
  "ge",
  "lt",
  "le",
  "and",
  "or",
  "not",
  "in",
  "has",
]);

const FILTER_FNS = new Set([
  "contains",
  "startswith",
  "endswith",
  "tolower",
  "toupper",
  "trim",
  "length",
  "indexof",
  "concat",
  "substring",
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function balancedParens(s: string): boolean {
  let depth = 0;
  for (const c of s) {
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

function balancedQuotes(s: string): boolean {
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "'") {
      if (inStr && s[i + 1] === "'") {
        i++;
        continue;
      }
      inStr = !inStr;
    }
  }
  return !inStr;
}

export function checkFilter(filter: string, entityName?: string): OdataIssue[] {
  const issues: OdataIssue[] = [];
  if (!balancedParens(filter)) {
    issues.push({ severity: "error", code: "filter.unbalanced-parens", message: "Unbalanced parentheses in $filter." });
  }
  if (!balancedQuotes(filter)) {
    issues.push({
      severity: "error",
      code: "filter.unbalanced-quotes",
      message: "Unbalanced single quotes. Escape literal quotes by doubling them ('O''Connor').",
    });
  }
  if (/=\s*[^=]/.test(filter) && !/\beq\b/i.test(filter)) {
    issues.push({
      severity: "error",
      code: "filter.equals-sign",
      message: "Found '=' — OData uses 'eq', not '=' (e.g. number eq '20002036').",
    });
  }
  if (/\beq\s+null\b/i.test(filter) || /\bne\s+null\b/i.test(filter)) {
    issues.push({
      severity: "warning",
      code: "filter.null-compare",
      message: "BC OData often rejects 'eq null'. For strings use eq '' or omit the predicate; for nullable decimals filter on a known sentinel.",
    });
  }
  // datetime literals must be ISO with Z or offset
  const dtMatches = filter.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s'),]*)/g) ?? [];
  for (const dt of dtMatches) {
    if (!ISO_DATETIME.test(dt)) {
      issues.push({
        severity: "warning",
        code: "filter.datetime-format",
        message: `Datetime literal '${dt}' is missing 'Z' or timezone offset. Use ISO 8601 like 2024-01-01T00:00:00Z.`,
      });
    }
  }
  // detect quoted strings around datetime literals (should be unquoted in OData v4)
  if (/'\d{4}-\d{2}-\d{2}T/.test(filter)) {
    issues.push({
      severity: "error",
      code: "filter.quoted-datetime",
      message: "OData v4 datetime literals are NOT quoted. Write `lastDateModified gt 2024-01-01T00:00:00Z`, not `gt '2024-01-01T00:00:00Z'`.",
    });
  }
  if (entityName) {
    const entity = getEntity(entityName);
    if (entity) {
      const referencedFields = extractFieldRefs(filter);
      const known = new Set(entity.fields.map((f) => f.name));
      for (const navProp of entity.navigationProperties) known.add(navProp.name);
      for (const ref of referencedFields) {
        if (!known.has(ref)) {
          issues.push({
            severity: "warning",
            code: "filter.unknown-field",
            message: `Field '${ref}' not found on entity '${entity.name}'. Available: ${[...known].slice(0, 15).join(", ")}…`,
          });
        }
      }
    }
  }
  return issues;
}

function extractFieldRefs(expr: string): string[] {
  const refs = new Set<string>();
  // Remove single-quoted strings
  const stripped = expr.replace(/'(?:[^']|'')*'/g, "");
  const tokens = stripped.split(/[\s(),]+/).filter(Boolean);
  for (const t of tokens) {
    if (FILTER_OPS.has(t.toLowerCase())) continue;
    if (FILTER_FNS.has(t.toLowerCase())) continue;
    if (/^\d/.test(t)) continue;
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) refs.add(t);
  }
  // Strip operator-like tokens
  for (const op of FILTER_OPS) refs.delete(op);
  for (const fn of FILTER_FNS) refs.delete(fn);
  // Drop literal keywords
  refs.delete("true");
  refs.delete("false");
  refs.delete("null");
  return [...refs];
}

export function checkSelect(select: string[], entityName: string): OdataIssue[] {
  const entity = getEntity(entityName);
  if (!entity) return [];
  const known = new Set(entity.fields.map((f) => f.name));
  for (const nav of entity.navigationProperties) known.add(nav.name);
  return select
    .filter((f) => !known.has(f))
    .map<OdataIssue>((f) => ({
      severity: "warning",
      code: "select.unknown-field",
      message: `$select includes '${f}' which is not declared on entity '${entity.name}'.`,
    }));
}

export function checkExpand(expand: string, entityName: string): OdataIssue[] {
  const issues: OdataIssue[] = [];
  const entity = getEntity(entityName);
  if (!entity) return issues;
  const navProps = new Set(entity.navigationProperties.map((n) => n.name));
  // Parse top-level expand segments respecting parentheses
  const segments = splitTopLevel(expand, ",");
  for (const seg of segments) {
    const match = seg.match(/^([A-Za-z_][A-Za-z0-9_]*)(\((.*)\))?$/);
    if (!match) {
      issues.push({
        severity: "error",
        code: "expand.syntax",
        message: `Cannot parse $expand segment '${seg}'.`,
      });
      continue;
    }
    const [, name, , nested] = match;
    if (!navProps.has(name)) {
      issues.push({
        severity: "warning",
        code: "expand.unknown-nav",
        message: `Navigation property '${name}' not declared on entity '${entity.name}'.`,
      });
    }
    if (nested) {
      const nestedTarget = entity.navigationProperties.find((n) => n.name === name)?.target;
      if (!/^\$expand=/.test(nested) && !/^\$select=/.test(nested) && !/^\$filter=/.test(nested)) {
        issues.push({
          severity: "error",
          code: "expand.nested-syntax",
          message: `Nested expand on '${name}' must use OData v4 form: ${name}($expand=child) or ($select=field).`,
        });
      }
      if (nestedTarget && /^\$expand=/.test(nested)) {
        const inner = nested.replace(/^\$expand=/, "");
        issues.push(...checkExpand(inner, nestedTarget));
      }
    }
  }
  return issues;
}

function splitTopLevel(s: string, delim: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const c of s) {
    if (c === "(") depth++;
    else if (c === ")") depth--;
    if (c === delim && depth === 0) {
      out.push(buf.trim());
      buf = "";
    } else {
      buf += c;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export interface CheckOdataInput {
  entity?: string;
  resourcePath?: string;
  filter?: string;
  select?: string[];
  expand?: string;
  orderby?: string;
  top?: number;
  skip?: number;
}

export function checkOdata(input: CheckOdataInput): OdataIssue[] {
  const issues: OdataIssue[] = [];
  const entity: Entity | undefined = input.entity
    ? getEntity(input.entity)
    : input.resourcePath
      ? findEntityByResourcePath(input.resourcePath)
      : undefined;
  const entityName = entity?.name;

  if (input.filter) issues.push(...checkFilter(input.filter, entityName));
  if (input.select && entityName) issues.push(...checkSelect(input.select, entityName));
  if (input.expand && entityName) issues.push(...checkExpand(input.expand, entityName));
  if (input.orderby && entityName) {
    const fields = input.orderby.split(",").map((p) => p.trim().split(/\s+/)[0]);
    issues.push(...checkSelect(fields, entityName).map((i) => ({ ...i, code: "orderby.unknown-field" })));
    if (/\b(asc|desc)\b\s+\b(asc|desc)\b/i.test(input.orderby)) {
      issues.push({
        severity: "error",
        code: "orderby.double-direction",
        message: "$orderby must have one direction per field.",
      });
    }
  }
  if (typeof input.top === "number" && (input.top < 0 || input.top > 20000)) {
    issues.push({
      severity: "warning",
      code: "top.range",
      message: "$top outside [0, 20000]. BC caps pages at 20000 rows regardless — use @odata.nextLink for full sweeps.",
    });
  }
  if (typeof input.skip === "number" && input.skip < 0) {
    issues.push({ severity: "error", code: "skip.negative", message: "$skip must be ≥ 0." });
  }

  // GUID utility — surface any GUID-looking strings missing valid format
  if (input.filter) {
    const guidLike = input.filter.match(/[0-9a-fA-F-]{30,}/g) ?? [];
    for (const g of guidLike) {
      if (!GUID.test(g)) {
        issues.push({
          severity: "warning",
          code: "filter.bad-guid",
          message: `'${g}' looks like a GUID but is malformed. Use 8-4-4-4-12 hex.`,
        });
      }
    }
  }

  // Date format check in filter
  if (input.filter) {
    const datesOnly = input.filter.match(/\b\d{4}-\d{2}-\d{2}\b(?!T)/g) ?? [];
    for (const d of datesOnly) {
      if (!ISO_DATE.test(d)) {
        issues.push({
          severity: "warning",
          code: "filter.bad-date",
          message: `Date literal '${d}' must be YYYY-MM-DD.`,
        });
      }
    }
  }

  return issues;
}
