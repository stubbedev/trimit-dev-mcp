import { ENTITIES, getEntity } from "./entities.js";
import { ENUMS } from "./enums.js";
import type { Entity, Field } from "./types.js";

export type PayloadShape = "minimal" | "full";
export type PayloadOperation = "create" | "patch";

function sampleValue(field: Field, shape: PayloadShape): unknown {
  if (field.enumRef) {
    const e = ENUMS[field.enumRef];
    return e ? e.values[0] : "";
  }
  switch (field.type) {
    case "string":
      return `<${field.name}>`;
    case "integer":
      return 0;
    case "number":
      return 0;
    case "decimal":
      return shape === "minimal" ? 0 : 0.0;
    case "boolean":
      return false;
    case "guid":
      return "00000000-0000-0000-0000-000000000000";
    case "date":
      return "2026-01-01";
    case "datetime":
      return "2026-01-01T00:00:00Z";
    case "array":
      return field.itemEntity ? [buildPayload(field.itemEntity, "create", shape)] : [];
    case "object":
      return {};
    default:
      return null;
  }
}

export function buildPayload(
  entityName: string,
  operation: PayloadOperation,
  shape: PayloadShape
): Record<string, unknown> {
  const entity = getEntity(entityName);
  if (!entity) return { error: `Unknown entity '${entityName}'` };

  const out: Record<string, unknown> = {};
  for (const field of entity.fields) {
    if (field.readOnly) continue;
    if (field.primaryKey && operation === "create" && field.type === "guid") continue;
    if (operation === "patch" && field.mutable === false) continue;

    const include =
      shape === "full"
        ? true
        : operation === "create"
          ? !!field.required
          : false;

    if (include) {
      out[field.name] = sampleValue(field, shape);
    }
  }
  if (operation === "patch" && shape === "minimal") {
    // PATCH minimal: show only one common mutable scalar so caller has a template
    const firstMutable = entity.fields.find(
      (f) => f.mutable && !f.readOnly && !f.primaryKey && f.type !== "array"
    );
    if (firstMutable) {
      out[firstMutable.name] = sampleValue(firstMutable, "minimal");
    }
  }
  return out;
}

export function listEntityNames(): string[] {
  return Object.keys(ENTITIES);
}

export function entitySummary(entity: Entity): Record<string, unknown> {
  return {
    name: entity.name,
    resourcePath: entity.resourcePath,
    category: entity.category,
    apiBase: entity.apiBase,
    keys: entity.keys,
    defaultExpand: entity.defaultExpand ?? [],
    fields: entity.fields.map((f) => ({
      name: f.name,
      type: f.type,
      enum: f.enumRef ? ENUMS[f.enumRef]?.values : undefined,
      required: !!f.required,
      mutable: f.readOnly ? false : f.mutable !== false,
      readOnly: !!f.readOnly,
      primaryKey: !!f.primaryKey,
      decimal: !!f.decimal,
      itemEntity: f.itemEntity,
      description: f.description,
    })),
    navigationProperties: entity.navigationProperties,
    notes: entity.notes,
  };
}
