export type LintSeverity = "error" | "warning" | "info";

export interface LintFinding {
  severity: LintSeverity;
  code: string;
  message: string;
  fix?: string;
}

interface Rule {
  code: string;
  severity: LintSeverity;
  detect: (snippet: string) => boolean;
  message: string;
  fix?: string;
}

const RULES: Rule[] = [
  {
    code: "auth.hardcoded-token",
    severity: "error",
    detect: (s) => /Bearer\s+ey[A-Za-z0-9_\-.]{20,}/.test(s),
    message: "Hardcoded JWT bearer token in source.",
    fix: "Fetch tokens at runtime from login.microsoftonline.com/{tenant}/oauth2/v2.0/token and cache them in memory.",
  },
  {
    code: "auth.hardcoded-secret",
    severity: "error",
    detect: (s) => /client[_-]?secret\s*[:=]\s*['"]?[A-Za-z0-9~._\-]{16,}['"]?/.test(s) && !/process\.env|getenv|os\.environ/.test(s),
    message: "Hardcoded client_secret. Load from environment / secret manager.",
  },
  {
    code: "auth.no-refresh",
    severity: "warning",
    detect: (s) => /fetch\(/.test(s) && /Bearer/.test(s) && !/(401|InvalidAuthenticationToken|expires_in|expiresAt|tokenExpiry|refresh)/i.test(s),
    message: "No token-refresh path detected. BC tokens expire ~1h; a long-running integration needs to handle 401 InvalidAuthenticationToken and re-acquire.",
  },
  {
    code: "paging.no-next-link",
    severity: "warning",
    detect: (s) => /\/(salesDocuments|salesOrders|salesInvoices|postedSalesInvoices|customers|items|masters|products|inventories|campaigns)\b/.test(s) && /fetch\(/.test(s) && !/@odata\.nextLink|nextLink|odata\.nextLink/.test(s),
    message: "Listing call without @odata.nextLink iteration. BC caps pages at 20 000 rows; large datasets silently truncate.",
    fix: "Loop while response['@odata.nextLink'] is set; fetch that URL with the same Authorization header.",
  },
  {
    code: "concurrency.no-if-match",
    severity: "error",
    detect: (s) => /method\s*:\s*['"]PATCH['"]/i.test(s) && !/If-Match/i.test(s),
    message: "PATCH without If-Match header. BC OData rejects PATCH without If-Match.",
    fix: "Add `If-Match: '*'` for unconditional update, or pass the @odata.etag value from a prior GET for optimistic concurrency.",
  },
  {
    code: "concurrency.no-ieee754",
    severity: "warning",
    detect: (s) => /(creditLimit|unitPrice|quantity|discountAmount|totalAmount|commissionPercent)/.test(s) && !/IEEE754Compatible/i.test(s),
    message: "Decimal field present without IEEE754Compatible: true. JS numbers can lose precision on large/high-scale decimals.",
    fix: "Send `IEEE754Compatible: true` header and represent decimals as JSON strings ('123.45').",
  },
  {
    code: "throttle.no-retry-after",
    severity: "warning",
    detect: (s) => /fetch\(/.test(s) && /(retry|backoff)/i.test(s) === false && /(\.status\s*===?\s*429|status\s*===?\s*429)/.test(s),
    message: "429 handling without Retry-After backoff. Respect the header to avoid compounding throttling.",
  },
  {
    code: "throttle.no-handling",
    severity: "info",
    detect: (s) => /fetch\(/.test(s) && /Bearer/.test(s) && !/429/.test(s),
    message: "No visible 429 handling. BC enforces global throttling; add backoff for any production integration.",
  },
  {
    code: "lifecycle.poll-without-exported",
    severity: "warning",
    detect: (s) => /\/salesDocuments\b/.test(s) && /poll|setInterval|setTimeout|while\s*\(/.test(s) && !/exportedDocuments/.test(s),
    message: "Polling /salesDocuments without using /exportedDocuments markers will re-deliver the same docs forever.",
    fix: "After processing each doc, POST /exportedDocuments {type, number}. Subsequent GETs exclude marked docs.",
  },
  {
    code: "lifecycle.processed-filter",
    severity: "info",
    detect: (s) => /\/salesDocuments\(\)/.test(s) && !/processedDate\s*gt\s*0001-01-01/.test(s),
    message: "GET /salesDocuments() (the parenthesized variant) is intended for processed docs. Pair with `$filter=(processedDate gt 0001-01-01)`.",
  },
  {
    code: "batch.absolute-urls",
    severity: "warning",
    detect: (s) => /\/\$batch/.test(s) && /"url"\s*:\s*"https?:/.test(s),
    message: "$batch sub-request URLs should be relative to the batch base, not absolute.",
  },
  {
    code: "batch.no-id",
    severity: "warning",
    detect: (s) => /\/\$batch/.test(s) && /"method"\s*:\s*"POST"/.test(s) && !/"id"\s*:/.test(s),
    message: "$batch sub-requests need a unique 'id' to match against the response.",
  },
  {
    code: "filter.unquoted-string",
    severity: "warning",
    detect: (s) => /\$filter=[^&]*\beq\s+[A-Za-z][A-Za-z0-9]*\b(?!\s*\()/.test(s) && !/eq\s+(null|true|false|\d)/.test(s),
    message: "Possible unquoted string literal in $filter. Wrap string values in single quotes: number eq '20002036'.",
  },
  {
    code: "filter.equals-sign",
    severity: "error",
    detect: (s) => /\$filter=[^&]*(?<!\w)=\s*[^=]/.test(s),
    message: "Found '=' in $filter — OData uses 'eq', not '='.",
  },
  {
    code: "doctype.lowercase",
    severity: "error",
    detect: (s) => /"docType"\s*:\s*"(order|quote|invoice|credit memo|blanket order|return order)"/.test(s),
    message: "docType is case-sensitive. 'order' will be rejected — use 'Order'.",
  },
  {
    code: "endpoint.wrong-base",
    severity: "warning",
    detect: (s) => /api\.businesscentral\.dynamics\.com\/v2\.0\/[^/]+\/[^/]+\/api\/v2\.0\/.*\/(masters|products|campaigns|exportedDocuments|salesDocuments)/.test(s),
    message: "Using /api/v2.0 path with a TRIMIT-only resource. Switch to /api/trimit/integration/v1.1.",
  },
];

export function lintSnippet(snippet: string): LintFinding[] {
  return RULES.filter((r) => r.detect(snippet)).map<LintFinding>(({ code, severity, message, fix }) => ({
    code,
    severity,
    message,
    fix,
  }));
}
