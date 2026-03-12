import type { JSONContent } from "@tiptap/react";

export type EditorMode = "template" | "document";

export type PageFormat = "A4";
export type PageOrientation = "portrait" | "landscape";

export type PageMargins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type PageSettings = {
  format: PageFormat;
  orientation: PageOrientation;
  margins: PageMargins;
  unit: "mm";
};

export type VariableType = "string" | "date" | "number" | "boolean";

export type VariableSchema = {
  path: string;
  label: string;
  type: VariableType;
  group: string;
  format?: string;
  fallback?: string;
};

export type EditorTemplate = {
  id: string;
  name: string;
  default_title?: string;
  template_type?: number;
  pageSettings: PageSettings;
  content: JSONContent;
  variableSchema: VariableSchema[];
  variableData?: Record<string, unknown>;
};

export type EditorTab = {
  id: string;
  templateId: string;
  name: string;
  modified: boolean;
};

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  format: "A4",
  orientation: "portrait",
  margins: { top: 20, right: 15, bottom: 20, left: 30 },
  unit: "mm",
};

export const DEFAULT_CONTENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export const DEFAULT_VARIABLE_SCHEMA: VariableSchema[] = [];

/**
 * Parse raw template_html (jsonb) from DB into EditorTemplate fields.
 * Handles both legacy format ({ default_title }) and new editor format.
 */
export function parseTemplateHtml(raw: Record<string, unknown> | null | undefined): {
  pageSettings: PageSettings;
  content: JSONContent;
  variableSchema: VariableSchema[];
  variableData?: Record<string, unknown>;
  default_title?: string;
} {
  if (!raw || typeof raw !== "object") {
    return { pageSettings: DEFAULT_PAGE_SETTINGS, content: DEFAULT_CONTENT, variableSchema: DEFAULT_VARIABLE_SCHEMA };
  }

  const pageSettings =
    raw.pageSettings && typeof raw.pageSettings === "object"
      ? { ...DEFAULT_PAGE_SETTINGS, ...(raw.pageSettings as Partial<PageSettings>) }
      : DEFAULT_PAGE_SETTINGS;

  const content =
    raw.content && typeof raw.content === "object" && (raw.content as JSONContent).type === "doc"
      ? (raw.content as JSONContent)
      : DEFAULT_CONTENT;

  const variableSchema =
    Array.isArray(raw.variableSchema) && raw.variableSchema.length > 0
      ? (raw.variableSchema as VariableSchema[])
      : DEFAULT_VARIABLE_SCHEMA;

  const variableData =
    raw.variableData && typeof raw.variableData === "object" && !Array.isArray(raw.variableData)
      ? (raw.variableData as Record<string, unknown>)
      : undefined;

  const default_title =
    typeof raw.default_title === "string" ? raw.default_title : undefined;

  return { pageSettings, content, variableSchema, variableData, default_title };
}

/**
 * Recursively collect unique `path` values from all templateVariable nodes
 * present in TipTap JSON content.
 */
export function extractUsedVariablePaths(node: JSONContent): Set<string> {
  const paths = new Set<string>();

  function walk(n: JSONContent) {
    if (n.type === "templateVariable" && typeof n.attrs?.path === "string") {
      paths.add(n.attrs.path);
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }

  walk(node);
  return paths;
}

/**
 * Return only the schema entries whose `path` is actually used in the content.
 */
export function filterUsedVariables(
  content: JSONContent,
  catalog: VariableSchema[],
): VariableSchema[] {
  const used = extractUsedVariablePaths(content);
  return catalog.filter((v) => used.has(v.path));
}

/**
 * Serialize editor state back to template_html jsonb for saving to DB.
 */
export function serializeTemplateHtml(
  content: JSONContent,
  pageSettings: PageSettings,
  variableSchema: VariableSchema[],
  defaultTitle?: string,
): Record<string, unknown> {
  return {
    ...(defaultTitle != null ? { default_title: defaultTitle } : {}),
    pageSettings,
    content,
    variableSchema,
  };
}
