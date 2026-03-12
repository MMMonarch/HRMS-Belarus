"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { EditorMode } from "../types";

type EditorModeContextValue = {
  mode: EditorMode;
  variableData: Record<string, unknown>;
};

const EditorModeContext = createContext<EditorModeContextValue>({
  mode: "template",
  variableData: {},
});

export function EditorModeProvider({
  mode,
  variableData,
  children,
}: EditorModeContextValue & { children: ReactNode }) {
  return (
    <EditorModeContext.Provider value={{ mode, variableData }}>
      {children}
    </EditorModeContext.Provider>
  );
}

export function useEditorMode() {
  return useContext(EditorModeContext);
}
