"use client";

import { useCallback, useRef, useState } from "react";
import { useCrudRef } from "@/lib/n8n/use-crud";
import { parseListResponse } from "@/lib/n8n/client";
import { useWorkspaceOptional } from "@/lib/context/workspace";
import type { EditorTemplate, VariableSchema } from "../types";
import {
  DEFAULT_PAGE_SETTINGS,
  DEFAULT_CONTENT,
  DEFAULT_VARIABLE_SCHEMA,
  parseTemplateHtml,
  serializeTemplateHtml,
} from "../types";
import type { JSONContent } from "@tiptap/react";

type RawRow = {
  id: string;
  name: string;
  template_type?: number;
  template_html?: Record<string, unknown> | null;
};

function toEditorTemplate(raw: RawRow): EditorTemplate {
  const parsed = parseTemplateHtml(raw.template_html ?? undefined);
  return {
    id: raw.id,
    name: raw.name,
    template_type: raw.template_type,
    default_title: parsed.default_title,
    pageSettings: parsed.pageSettings,
    content: parsed.content,
    variableSchema: parsed.variableSchema,
    variableData: parsed.variableData,
  };
}

export function useEditorTemplates() {
  const crudRef = useCrudRef();
  const workspace = useWorkspaceOptional();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef(false);

  const loadTemplate = useCallback(
    async (id: string): Promise<EditorTemplate | null> => {
      setLoading(true);
      try {
        const data = await crudRef.current("templates", "get", undefined, id);
        let row: RawRow | undefined;

        if (Array.isArray(data)) {
          row = (data as RawRow[]).find((r) => r.id === id) ?? (data[0] as RawRow | undefined);
        } else if (data && typeof data === "object") {
          const d = data as Record<string, unknown>;
          if (typeof d.id === "string") {
            row = d as unknown as RawRow;
          } else {
            const rows = parseListResponse(data) as RawRow[];
            row = rows.find((r) => r.id === id) ?? (rows[0] as RawRow | undefined);
          }
        }

        if (!row) return null;
        return toEditorTemplate(row);
      } catch {
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadTemplateList = useCallback(async (): Promise<EditorTemplate[]> => {
    setLoading(true);
    try {
      const data = await crudRef.current("templates", "get");
      const rows = parseListResponse(data) as RawRow[];
      return rows.map(toEditorTemplate);
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const saveTemplate = useCallback(
    async (
      id: string,
      content: JSONContent,
      pageSettings = DEFAULT_PAGE_SETTINGS,
      variableSchema: VariableSchema[] = DEFAULT_VARIABLE_SCHEMA,
      defaultTitle?: string,
    ): Promise<boolean> => {
      setSaving(true);
      try {
        const template_html = serializeTemplateHtml(
          content,
          pageSettings,
          variableSchema,
          defaultTitle,
        );
        await crudRef.current("templates", "update", { template_html }, id);
        return true;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const loadVariableCatalog = useCallback(
    async (
      templateType?: number,
    ): Promise<{ variables: VariableSchema[]; variableData?: Record<string, unknown> }> => {
      try {
        const data = await crudRef.current("EDITOR", "get", {
          type: "templates",
          scope: "template_variables",
          template_type: templateType ?? null,
        });

        // Response may be { variables | variableSchema: VariableSchema[], variableData?: object } or raw array
        if (data && typeof data === "object" && !Array.isArray(data)) {
          const obj = data as Record<string, unknown>;
          const vars = (obj.variables ?? obj.variableSchema) as unknown;
          let variables: VariableSchema[] = [];
          if (Array.isArray(vars) && vars.length > 0 && typeof (vars[0] as Record<string, unknown>).path === "string") {
            variables = vars as VariableSchema[];
          }
          const variableData =
            obj.variableData && typeof obj.variableData === "object" && !Array.isArray(obj.variableData)
              ? (obj.variableData as Record<string, unknown>)
              : undefined;
          return { variables, variableData };
        }

        const rows = parseListResponse(data);
        if (rows.length > 0 && typeof (rows[0] as Record<string, unknown>).path === "string") {
          return { variables: rows as unknown as VariableSchema[] };
        }
        if (rows.length === 1) {
          const wrapper = rows[0] as Record<string, unknown>;
          const vars = (wrapper.variables ?? wrapper.variableSchema) as unknown;
          if (Array.isArray(vars) && vars.length > 0 && typeof (vars[0] as Record<string, unknown>).path === "string") {
            const variables = vars as VariableSchema[];
            const variableData =
              wrapper.variableData && typeof wrapper.variableData === "object" && !Array.isArray(wrapper.variableData)
                ? (wrapper.variableData as Record<string, unknown>)
                : undefined;
            return { variables, variableData };
          }
        }
        return { variables: [] };
      } catch {
        return { variables: [] };
      }
    },
    [],
  );

  const createTemplate = useCallback(
    async (
      name: string,
      templateType: number,
      content: JSONContent = DEFAULT_CONTENT,
      pageSettings = DEFAULT_PAGE_SETTINGS,
      variableSchema: VariableSchema[] = DEFAULT_VARIABLE_SCHEMA,
    ): Promise<string | null> => {
      setSaving(true);
      try {
        const template_html = serializeTemplateHtml(
          content,
          pageSettings,
          variableSchema,
          name,
        );
        const result = await crudRef.current("templates", "create", {
          name,
          template_type: templateType,
          template_html,
          branch_id: workspace?.branchId ?? undefined,
        });
        const rows = parseListResponse(result) as { id: string }[];
        return rows[0]?.id ?? null;
      } catch {
        return null;
      } finally {
        setSaving(false);
      }
    },
    [workspace?.branchId],
  );

  return {
    loading,
    saving,
    loadTemplate,
    loadTemplateList,
    loadVariableCatalog,
    saveTemplate,
    createTemplate,
  };
}
