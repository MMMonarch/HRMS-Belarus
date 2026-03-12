import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { JSONContent } from "@tiptap/react";
import type { PageSettings, VariableSchema } from "../types";
import { DEFAULT_CONTENT, DEFAULT_PAGE_SETTINGS, DEFAULT_VARIABLE_SCHEMA } from "../types";

export interface TabState {
  tabId: string;
  templateId: string;
  templateType?: number;
  /** When set, this tab represents a print output for a consolidated order (not a template). */
  orderId?: string;
  name: string;
  defaultTitle?: string;
  modified: boolean;
  content: JSONContent;
  pageSettings: PageSettings;
  variableSchema: VariableSchema[];
}

interface EditorTabsStore {
  tabs: TabState[];
  activeTabId: string | null;

  openTemplate: (tpl: {
    id: string;
    name: string;
    templateType?: number;
    orderId?: string;
    defaultTitle?: string;
    content: JSONContent;
    pageSettings: PageSettings;
    variableSchema: VariableSchema[];
    variableData?: Record<string, unknown>;
  }) => void;
  closeTab: (tabId: string) => void;
  selectTab: (tabId: string | null) => void;
  snapshotContent: (tabId: string, content: JSONContent) => void;
  markModified: (tabId: string) => void;
  markSaved: (tabId: string) => void;
  updatePageSettings: (tabId: string, settings: PageSettings) => void;
}

const EMPTY_VARIABLE_DATA: Record<string, unknown> = {};

/**
 * In-memory cache for variableData, kept out of sessionStorage to avoid
 * hitting the 5 MB limit on large consolidated orders (100+ employees).
 * Lost on page reload — acceptable because variableData is re-fetched
 * from n8n when re-opening a document.
 */
const variableDataCache = new Map<string, Record<string, unknown>>();

export function getTabVariableData(tabId: string): Record<string, unknown> {
  return variableDataCache.get(tabId) ?? EMPTY_VARIABLE_DATA;
}

export function setTabVariableData(tabId: string, data: Record<string, unknown>): void {
  variableDataCache.set(tabId, data);
}

export const useEditorTabsStore = create<EditorTabsStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      openTemplate(tpl) {
        const { tabs } = get();
        const lookupId = tpl.orderId ? `order-${tpl.orderId}` : tpl.id;
        const existing = tpl.orderId
          ? tabs.find((t) => t.orderId === tpl.orderId)
          : tabs.find((t) => t.templateId === tpl.id && !t.orderId);
        if (existing) {
          if (tpl.variableData) {
            variableDataCache.set(existing.tabId, tpl.variableData);
          }
          set({
            activeTabId: existing.tabId,
            tabs: tabs.map((t) =>
              t.tabId === existing.tabId
                ? { ...t, content: tpl.content, pageSettings: tpl.pageSettings, variableSchema: tpl.variableSchema, modified: false }
                : t,
            ),
          });
          return;
        }
        const tabId = `tab-${lookupId}`;
        const newTab: TabState = {
          tabId,
          templateId: tpl.id,
          templateType: tpl.templateType,
          orderId: tpl.orderId,
          name: tpl.name,
          defaultTitle: tpl.defaultTitle,
          modified: false,
          content: tpl.content,
          pageSettings: tpl.pageSettings,
          variableSchema: tpl.variableSchema,
        };
        if (tpl.variableData) {
          variableDataCache.set(tabId, tpl.variableData);
        }
        set({ tabs: [...tabs, newTab], activeTabId: tabId });
      },

      closeTab(tabId) {
        variableDataCache.delete(tabId);
        const { tabs, activeTabId } = get();
        const next = tabs.filter((t) => t.tabId !== tabId);
        if (activeTabId === tabId) {
          const fallback = next.length > 0 ? next[next.length - 1].tabId : null;
          set({ tabs: next, activeTabId: fallback });
        } else {
          set({ tabs: next });
        }
      },

      selectTab(tabId) {
        set({ activeTabId: tabId });
      },

      snapshotContent(tabId, content) {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.tabId === tabId ? { ...t, content } : t,
          ),
        }));
      },

      markModified(tabId) {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.tabId === tabId ? { ...t, modified: true } : t,
          ),
        }));
      },

      markSaved(tabId) {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.tabId === tabId ? { ...t, modified: false } : t,
          ),
        }));
      },

      updatePageSettings(tabId, settings) {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.tabId === tabId ? { ...t, pageSettings: settings } : t,
          ),
        }));
      },
    }),
    {
      name: "editor-tabs",
      storage: {
        getItem(name) {
          const raw = sessionStorage.getItem(name);
          return raw ? JSON.parse(raw) : null;
        },
        setItem(name, value) {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem(name) {
          sessionStorage.removeItem(name);
        },
      },
    },
  ),
);

export function getActiveTab(state: EditorTabsStore): TabState | undefined {
  return state.tabs.find((t) => t.tabId === state.activeTabId);
}
