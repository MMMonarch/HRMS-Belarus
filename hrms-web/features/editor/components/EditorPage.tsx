"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { CustomTableCell } from "../extensions/custom-table-cell";
import { CustomTableHeader } from "../extensions/custom-table-cell";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { TemplateVariable } from "../extensions/template-variable";
import { Pagination } from "../extensions/pagination";
import { FontSize } from "../extensions/font-size";
import { ParagraphIndent } from "../extensions/paragraph-indent";
import { LineIndent } from "../extensions/line-indent";
import { EditorModeProvider } from "../context/editor-mode";
import { EditorToolbar } from "./EditorToolbar";
import { EditorSidebar } from "./EditorSidebar";
import { EditorContent } from "./EditorContent";
import { EditorTabs } from "./EditorTabs";
import { ZoomControl } from "./ZoomControl";
import { useEditorTemplates } from "../hooks/useEditorTemplates";
import { useEditorTabsStore, getActiveTab, getTabVariableData, setTabVariableData } from "../store/editor-tabs-store";
import type { EditorMode, EditorTemplate, PageSettings, VariableSchema } from "../types";
import { DEFAULT_CONTENT, DEFAULT_PAGE_SETTINGS, DEFAULT_VARIABLE_SCHEMA, filterUsedVariables, parseTemplateHtml, serializeTemplateHtml } from "../types";
import { useCrudRef } from "@/lib/n8n/use-crud";
import "../styles/editor.css";
import "../styles/editor-print.css";

import { PageSettingsDialog } from "./PageSettingsDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const MM = 3.7795275591;

export function EditorPage() {
  const searchParams = useSearchParams();
  const templateIdParam = searchParams.get("templateId");
  const orderIdParam = searchParams.get("orderId");
  const crudRef = useCrudRef();

  const { loading, saving, loadTemplateList, loadVariableCatalog, saveTemplate } =
    useEditorTemplates();

  const tabs = useEditorTabsStore((s) => s.tabs);
  const activeTabId = useEditorTabsStore((s) => s.activeTabId);
  const storeOpenTemplate = useEditorTabsStore((s) => s.openTemplate);
  const closeTab = useEditorTabsStore((s) => s.closeTab);
  const selectTab = useEditorTabsStore((s) => s.selectTab);
  const snapshotContent = useEditorTabsStore((s) => s.snapshotContent);
  const markModified = useEditorTabsStore((s) => s.markModified);
  const markSaved = useEditorTabsStore((s) => s.markSaved);
  const updatePageSettings = useEditorTabsStore((s) => s.updatePageSettings);

  const activeTab = useEditorTabsStore(getActiveTab);

  const [mode, setMode] = useState<EditorMode>("template");
  const [zoom, setZoom] = useState(0.8);
  const [templateList, setTemplateList] = useState<EditorTemplate[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [catalogVariables, setCatalogVariables] = useState<VariableSchema[]>([]);
  const [catalogVariableData, setCatalogVariableData] = useState<Record<string, unknown> | undefined>(undefined);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const catalogCacheRef = useRef<
    Map<number | undefined, { variables: VariableSchema[]; variableData?: Record<string, unknown> }>
  >(new Map());
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null);

  const filteredTemplateList = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    const list = q
      ? templateList.filter(
          (tpl) =>
            tpl.name.toLowerCase().includes(q) ||
            tpl.default_title?.toLowerCase().includes(q),
        )
      : templateList;
    return list.slice().sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [templateList, templateSearch]);

  const didInit = useRef(false);
  const prevActiveTabIdRef = useRef<string | null>(null);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    main.style.overflow = "hidden";
    main.style.padding = "0";
    return () => {
      main.style.overflow = "";
      main.style.padding = "";
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Table.configure({ resizable: true }),
      TableRow,
      CustomTableCell,
      CustomTableHeader,
      Underline,
      TextStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      FontSize,
      ParagraphIndent,
      LineIndent,
      TemplateVariable,
      Pagination,
    ],
    content: DEFAULT_CONTENT,
    editable: mode === "template",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap",
      },
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(mode === "template");
    }
  }, [mode, editor]);

  const pageSettings = activeTab?.pageSettings ?? DEFAULT_PAGE_SETTINGS;
  const variableSchema = activeTab?.variableSchema ?? DEFAULT_VARIABLE_SCHEMA;

  useEffect(() => {
    if (!activeTab) {
      setCatalogVariables([]);
      setCatalogVariableData(undefined);
      return;
    }
    const tabId = activeTab.tabId;
    const tType = activeTab.templateType;
    const tabAlreadyHasData = Object.keys(getTabVariableData(tabId)).length > 0;
    const cached = catalogCacheRef.current.get(tType);
    if (cached) {
      setCatalogVariables(cached.variables);
      setCatalogVariableData(cached.variableData);
      if (cached.variableData && !tabAlreadyHasData) {
        setTabVariableData(tabId, cached.variableData);
      }
      return;
    }
    setCatalogLoading(true);
    void loadVariableCatalog(tType).then(({ variables, variableData }) => {
      if (variables.length > 0 || variableData) {
        catalogCacheRef.current.set(tType, { variables, variableData });
      }
      setCatalogVariables(variables);
      setCatalogVariableData(variableData);
      if (variableData && !tabAlreadyHasData) {
        setTabVariableData(tabId, variableData);
      }
      setCatalogLoading(false);
    });
  }, [activeTab?.tabId, activeTab?.templateType, loadVariableCatalog]);

  const sidebarVariables = catalogVariables;

  useEffect(() => {
    if (!editor) return;
    const ph =
      pageSettings.orientation === "portrait" ? 297 * MM : 210 * MM;
    editor.commands.updatePagination({
      pageHeightPx: ph,
      marginTopPx: pageSettings.margins.top * MM,
      marginBottomPx: pageSettings.margins.bottom * MM,
      gapPx: 32,
    });
  }, [editor, pageSettings]);

  // ---- Tab switch: snapshot old, load new ----
  useEffect(() => {
    if (!editor) return;
    const prevId = prevActiveTabIdRef.current;

    if (prevId && prevId !== activeTabId) {
      snapshotContent(prevId, editor.getJSON());
    }

    prevActiveTabIdRef.current = activeTabId;

    const content = activeTab ? activeTab.content : DEFAULT_CONTENT;
    // Defer setContent to a microtask — TipTap internally calls flushSync
    // which cannot run inside a React useEffect commit phase.
    queueMicrotask(() => {
      editor.commands.setContent(content);
    });
  }, [activeTabId, editor]);

  // ---- Init: open template/order from URL or restore from store ----
  useEffect(() => {
    if (didInit.current || !editor) return;
    didInit.current = true;

    if (orderIdParam) {
      const raw = sessionStorage.getItem(`print-order-${orderIdParam}`);
      if (raw) {
        try {
          const data = JSON.parse(raw) as Record<string, unknown>;
          const parsed = parseTemplateHtml(data);
          storeOpenTemplate({
            id: orderIdParam,
            orderId: orderIdParam,
            name: "Печать приказа",
            defaultTitle: typeof data.default_title === "string" ? data.default_title : undefined,
            content: parsed.content,
            pageSettings: parsed.pageSettings,
            variableSchema: parsed.variableSchema,
            variableData: parsed.variableData,
          });
        } catch {
          toast.error("Не удалось загрузить данные для печати");
        }
      }
      void loadTemplateList().then(setTemplateList);
    } else if (templateIdParam) {
      void loadTemplateList().then((list) => {
        setTemplateList(list);
        const tpl = list.find((t) => t.id === templateIdParam);
        if (tpl) {
          storeOpenTemplate({
            id: tpl.id,
            name: tpl.name,
            templateType: tpl.template_type,
            defaultTitle: tpl.default_title,
            content: tpl.content,
            pageSettings: tpl.pageSettings,
            variableSchema: tpl.variableSchema,
            variableData: tpl.variableData,
          });
        }
      });
    } else if (activeTab) {
      queueMicrotask(() => {
        editor.commands.setContent(activeTab.content);
      });
    } else {
      void loadTemplateList().then(setTemplateList);
    }
  }, [editor]);

  const handleOpenTemplate = useCallback(
    async (id: string) => {
      const existing = tabs.find((t) => t.templateId === id);
      if (existing) {
        if (editor && activeTabId) {
          snapshotContent(activeTabId, editor.getJSON());
        }
        selectTab(existing.tabId);
        return;
      }

      let tpl = templateList.find((t) => t.id === id);
      if (!tpl) {
        const all = await loadTemplateList();
        setTemplateList(all);
        tpl = all.find((t) => t.id === id);
      }
      if (!tpl) {
        toast.error("Шаблон не найден");
        return;
      }

      if (editor && activeTabId) {
        snapshotContent(activeTabId, editor.getJSON());
      }

      storeOpenTemplate({
        id: tpl.id,
        name: tpl.name,
        templateType: tpl.template_type,
        defaultTitle: tpl.default_title,
        content: tpl.content,
        pageSettings: tpl.pageSettings,
        variableSchema: tpl.variableSchema,
        variableData: tpl.variableData,
      });
    },
    [editor, activeTabId, tabs, templateList, loadTemplateList, snapshotContent, selectTab, storeOpenTemplate],
  );

  const handleSelectTab = useCallback(
    (tabId: string | null) => {
      if (tabId === activeTabId) return;
      if (editor && activeTabId) {
        snapshotContent(activeTabId, editor.getJSON());
      }
      selectTab(tabId);

      if (tabId === null) {
        void loadTemplateList().then(setTemplateList);
      }
    },
    [editor, activeTabId, snapshotContent, selectTab, loadTemplateList],
  );

  const doCloseTab = useCallback(
    (tabId: string) => {
      if (editor && tabId === activeTabId) {
        snapshotContent(tabId, editor.getJSON());
      }
      closeTab(tabId);
    },
    [editor, activeTabId, snapshotContent, closeTab],
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.tabId === tabId);
      if (tab?.modified) {
        setPendingCloseTabId(tabId);
        return;
      }
      doCloseTab(tabId);
    },
    [tabs, doCloseTab],
  );

  const pendingCloseTab = pendingCloseTabId
    ? tabs.find((t) => t.tabId === pendingCloseTabId)
    : null;

  const handleConfirmSaveAndClose = useCallback(async () => {
    if (!pendingCloseTab || !editor) return;
    const isActive = pendingCloseTab.tabId === activeTabId;
    const json = isActive ? editor.getJSON() : pendingCloseTab.content;
    const allVars = [...pendingCloseTab.variableSchema, ...catalogVariables];
    const usedVars = filterUsedVariables(json, allVars);

    if (pendingCloseTab.orderId) {
      try {
        const printOutput = serializeTemplateHtml(
          json,
          pendingCloseTab.pageSettings,
          usedVars,
          pendingCloseTab.defaultTitle,
        );
        const variableData = getTabVariableData(pendingCloseTab.tabId);
        if (variableData && Object.keys(variableData).length > 0) {
          (printOutput as Record<string, unknown>).variableData = variableData;
        }
        await crudRef.current(
          "orders",
          "update",
          { print_output: printOutput },
          pendingCloseTab.orderId,
        );
        toast.success("Печатная форма сохранена");
        doCloseTab(pendingCloseTab.tabId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
      }
      setPendingCloseTabId(null);
      return;
    }

    const ok = await saveTemplate(
      pendingCloseTab.templateId,
      json,
      pendingCloseTab.pageSettings,
      usedVars,
      pendingCloseTab.defaultTitle,
    );
    if (ok) {
      toast.success("Шаблон сохранён");
      doCloseTab(pendingCloseTab.tabId);
    } else {
      toast.error("Ошибка сохранения");
    }
    setPendingCloseTabId(null);
  }, [pendingCloseTab, editor, activeTabId, saveTemplate, doCloseTab, catalogVariables]);

  const handleConfirmDiscard = useCallback(() => {
    if (pendingCloseTabId) {
      doCloseTab(pendingCloseTabId);
    }
    setPendingCloseTabId(null);
  }, [pendingCloseTabId, doCloseTab]);

  const [savingOrder, setSavingOrder] = useState(false);

  const handleSave = useCallback(async () => {
    if (!activeTab || !editor) return;
    const json = editor.getJSON();
    const allVars = [...activeTab.variableSchema, ...catalogVariables];
    const usedVars = filterUsedVariables(json, allVars);

    if (activeTab.orderId) {
      setSavingOrder(true);
      try {
        const printOutput = serializeTemplateHtml(
          json,
          activeTab.pageSettings,
          usedVars,
          activeTab.defaultTitle,
        );
        const variableData = getTabVariableData(activeTab.tabId);
        if (variableData && Object.keys(variableData).length > 0) {
          (printOutput as Record<string, unknown>).variableData = variableData;
        }
        await crudRef.current(
          "orders",
          "update",
          { print_output: printOutput },
          activeTab.orderId,
        );
        snapshotContent(activeTab.tabId, json);
        markSaved(activeTab.tabId);
        toast.success("Печатная форма сохранена");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка сохранения печатной формы");
      } finally {
        setSavingOrder(false);
      }
      return;
    }

    const ok = await saveTemplate(
      activeTab.templateId,
      json,
      activeTab.pageSettings,
      usedVars,
      activeTab.defaultTitle,
    );
    if (ok) {
      snapshotContent(activeTab.tabId, json);
      markSaved(activeTab.tabId);
      toast.success("Шаблон сохранён");
    } else {
      toast.error("Ошибка сохранения");
    }
  }, [activeTab, editor, saveTemplate, snapshotContent, markSaved, catalogVariables]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleShowTemplateList = useCallback(() => {
    if (editor && activeTabId) {
      snapshotContent(activeTabId, editor.getJSON());
    }
    selectTab(null);
    void loadTemplateList().then(setTemplateList);
  }, [editor, activeTabId, snapshotContent, selectTab, loadTemplateList]);

  const handleClearVariablesCache = useCallback(() => {
    if (!activeTab) return;
    const tType = activeTab.templateType;
    catalogCacheRef.current.delete(tType);
    setCatalogLoading(true);
    void loadVariableCatalog(tType).then(({ variables, variableData }) => {
      setCatalogVariables(variables);
      setCatalogVariableData(variableData);
      setTabVariableData(activeTab.tabId, variableData ?? {});
      setCatalogLoading(false);
      toast.success("Кеш переменных очищен, данные загружены заново");
    });
  }, [activeTab, loadVariableCatalog]);

  const handleApplyPageSettings = useCallback(
    (settings: PageSettings) => {
      if (activeTab) {
        updatePageSettings(activeTab.tabId, settings);
      }
    },
    [activeTab, updatePageSettings],
  );

  // ---- Track modifications ----
  useEffect(() => {
    if (!editor || !activeTab) return;
    const handler = () => {
      markModified(activeTab.tabId);
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor, activeTab?.tabId, markModified]);

  // ---- Print @page style injection ----
  useEffect(() => {
    const id = "editor-page-style";
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.head.appendChild(style);
    }
    const { top, right, bottom, left } = pageSettings.margins;
    const orient = pageSettings.orientation;
    style.textContent = `@media print { @page { size: A4 ${orient}; margin: ${top}mm ${right}mm ${bottom}mm ${left}mm; } }`;
    return () => {
      style?.parentNode?.removeChild(style);
    };
  }, [pageSettings.margins, pageSettings.orientation]);

  const tabVariableData = activeTab ? getTabVariableData(activeTab.tabId) : getTabVariableData("");
  const variableData = useMemo(() => {
    const hasTab = tabVariableData && Object.keys(tabVariableData).length > 0;
    const hasCatalog = catalogVariableData && Object.keys(catalogVariableData).length > 0;
    if (hasTab && hasCatalog) return { ...catalogVariableData, ...tabVariableData };
    if (hasCatalog) return catalogVariableData;
    return tabVariableData;
  }, [tabVariableData, catalogVariableData]);
  const modeContextValue = useMemo(
    () => ({ mode, variableData }),
    [mode, variableData],
  );

  const isTemplateListVisible = activeTabId === null;

  return (
    <EditorModeProvider mode={modeContextValue.mode} variableData={modeContextValue.variableData}>
      <div className="editor-root flex h-full flex-col overflow-hidden">
        {/* Tabs */}
        <EditorTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
        />

        {isTemplateListVisible ? (
          /* ---- Template list panel ---- */
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {loading && (
              <p className="text-sm text-muted-foreground">Загрузка…</p>
            )}
            {!loading && templateList.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Нет шаблонов. Создайте шаблон в разделе Справочники → Шаблоны.
              </p>
            )}
            {!loading && templateList.length > 0 && (
              <>
                <div className="relative mb-3 max-w-sm">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Поиск шаблона…"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                {filteredTemplateList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ничего не найдено
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredTemplateList.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        className="rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
                        onClick={() => handleOpenTemplate(tpl.id)}
                      >
                        <p className="text-sm font-medium">{tpl.name}</p>
                        {tpl.default_title && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {tpl.default_title}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* ---- Editor view ---- */
          <>
            <EditorToolbar
              editor={editor}
              mode={mode}
              onModeChange={setMode}
              onSave={handleSave}
              onPrint={handlePrint}
              onPageSettings={() => setShowPageSettings(true)}
              onShowTemplateList={handleShowTemplateList}
              onClearVariablesCache={handleClearVariablesCache}
              saving={saving || savingOrder}
              hasTemplate={!!activeTab}
            />

            <div className="flex flex-1 min-h-0 overflow-hidden">
              <EditorSidebar
                editor={editor}
                variables={sidebarVariables}
                variableData={catalogVariableData}
                loading={catalogLoading}
                className={mode !== "template" ? "hidden" : undefined}
              />
              <div className="relative flex flex-1 flex-col overflow-hidden">
                <EditorContent
                  editor={editor}
                  pageSettings={pageSettings}
                  zoom={zoom}
                />
                <ZoomControl
                  zoom={zoom}
                  onZoomChange={setZoom}
                  className="absolute bottom-3 right-3 z-10"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <PageSettingsDialog
        open={showPageSettings}
        onOpenChange={setShowPageSettings}
        pageSettings={pageSettings}
        onApply={handleApplyPageSettings}
      />

      <Dialog
        open={!!pendingCloseTabId}
        onOpenChange={(open) => { if (!open) setPendingCloseTabId(null); }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Несохранённые изменения</DialogTitle>
            <DialogDescription>
              Шаблон «{pendingCloseTab?.name}» содержит несохранённые изменения.
              Сохранить перед закрытием?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingCloseTabId(null)}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDiscard}
            >
              Не сохранять
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSaveAndClose}
              disabled={saving}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EditorModeProvider>
  );
}
