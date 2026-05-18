export type FieldType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "guid"
  | "date"
  | "datetime"
  | "decimal"
  | "enum"
  | "array"
  | "object";

export interface Field {
  name: string;
  type: FieldType;
  required?: boolean;
  mutable?: boolean;
  readOnly?: boolean;
  primaryKey?: boolean;
  enumRef?: string;
  itemEntity?: string;
  decimal?: boolean;
  description?: string;
}

export interface NavigationProperty {
  name: string;
  target: string;
  multiplicity: "one" | "many";
}

export interface Entity {
  name: string;
  resourcePath: string;
  category: string;
  apiBase: "trimit" | "std";
  keys: string[];
  fields: Field[];
  navigationProperties: NavigationProperty[];
  defaultExpand?: string[];
  notes?: string;
}

export interface EnumDef {
  name: string;
  values: string[];
  caseSensitive: boolean;
  description: string;
}
