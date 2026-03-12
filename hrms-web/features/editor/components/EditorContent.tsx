"use client";

import type { Editor } from "@tiptap/react";
import { EditorContent as TipTapEditorContent } from "@tiptap/react";
import type { PageSettings } from "../types";
import { cn } from "@/lib/utils";
import { EditorRuler } from "./EditorRuler";

type EditorContentProps = {
  editor: Editor | null;
  pageSettings: PageSettings;
  zoom: number;
  className?: string;
};

const MM_TO_PX = 3.7795275591;

function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}

export function EditorContent({
  editor,
  pageSettings,
  zoom,
  className,
}: EditorContentProps) {
  const pageWidthPx = pageSettings.orientation === "portrait" ? mmToPx(210) : mmToPx(297);
  const pageHeightPx = pageSettings.orientation === "portrait" ? mmToPx(297) : mmToPx(210);
  const { margins } = pageSettings;

  return (
    <div
      className={cn(
        "editor-desk flex-1 overflow-auto bg-muted/50",
        className,
      )}
    >
      {/* Sticky ruler — stays at top while scrolling */}
      <div className="editor-ruler-wrap sticky top-0 z-20">
        <EditorRuler
          editor={editor}
          pageSettings={pageSettings}
          zoom={zoom}
        />
      </div>

      <div
        className="editor-page-wrapper mx-auto"
        style={{
          transformOrigin: "top left",
          transform: `scale(${zoom})`,
          width: pageWidthPx * zoom,
          paddingTop: 24,
          paddingBottom: 24,
        }}
      >
        <div
          className="editor-page relative mx-auto"
          style={{
            width: pageWidthPx,
            minHeight: pageHeightPx,
            paddingTop: mmToPx(margins.top),
            paddingRight: mmToPx(margins.right),
            paddingBottom: mmToPx(margins.bottom),
            paddingLeft: mmToPx(margins.left),
            ["--page-pl" as string]: `${mmToPx(margins.left)}px`,
            ["--page-pr" as string]: `${mmToPx(margins.right)}px`,
          }}
        >
          <TipTapEditorContent editor={editor} className="editor-content" />
        </div>
      </div>
    </div>
  );
}
