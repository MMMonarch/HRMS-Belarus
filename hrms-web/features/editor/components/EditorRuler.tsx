"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { Editor } from "@tiptap/react";
import type { PageSettings } from "../types";

const MM_TO_PX = 3.7795275591;

type MarkerType = "left" | "right" | "firstLine";

type IndentState = {
  indentLeft: number;
  indentRight: number;
  textIndent: number;
};

const RULER_H = 22;
const MARKER_W = 10;
const MARKER_H = 7;
const MIN_CONTENT_MM = 5;

function readIndents(editor: Editor): IndentState {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "paragraph" || node.type.name === "heading") {
      return {
        indentLeft: (node.attrs.indentLeft as number) || 0,
        indentRight: (node.attrs.indentRight as number) || 0,
        textIndent: (node.attrs.textIndent as number) || 0,
      };
    }
  }
  return { indentLeft: 0, indentRight: 0, textIndent: 0 };
}

type Props = {
  editor: Editor | null;
  pageSettings: PageSettings;
  zoom: number;
};

export function EditorRuler({ editor, pageSettings, zoom }: Props) {
  const [indents, setIndents] = useState<IndentState>({
    indentLeft: 0,
    indentRight: 0,
    textIndent: 0,
  });
  const [dragging, setDragging] = useState<MarkerType | null>(null);
  const draggingRef = useRef<MarkerType | null>(null);
  const draftRef = useRef<IndentState>(indents);
  const rulerRef = useRef<HTMLDivElement>(null);
  const startRectRef = useRef<DOMRect | null>(null);

  const pageWidthMm = pageSettings.orientation === "portrait" ? 210 : 297;
  const { margins } = pageSettings;
  const contentWidthMm = pageWidthMm - margins.left - margins.right;
  const totalWidth = pageWidthMm * MM_TO_PX * zoom;

  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      if (draggingRef.current) return;
      const vals = readIndents(editor);
      setIndents(vals);
      draftRef.current = vals;
    };
    sync();
    editor.on("selectionUpdate", sync);
    editor.on("update", sync);
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("update", sync);
    };
  }, [editor]);

  const mmToPx = useCallback(
    (mm: number) => mm * MM_TO_PX * zoom,
    [zoom],
  );

  const snap = (v: number) => Math.round(v * 2) / 2;

  const leftPos = mmToPx(margins.left + indents.indentLeft);
  const firstLinePos = mmToPx(
    margins.left + indents.indentLeft + indents.textIndent,
  );
  const rightPos = mmToPx(
    pageWidthMm - margins.right - indents.indentRight,
  );

  const onMarkerDown = useCallback(
    (type: MarkerType) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = type;
      draftRef.current = { ...indents };
      startRectRef.current =
        rulerRef.current?.getBoundingClientRect() ?? null;
      setDragging(type);
    },
    [indents],
  );

  useEffect(() => {
    if (!dragging || !editor) return;

    const onMove = (e: MouseEvent) => {
      const rect = startRectRef.current;
      if (!rect) return;
      const mm = (e.clientX - rect.left) / (MM_TO_PX * zoom);
      const d = { ...draftRef.current };

      if (dragging === "left") {
        d.indentLeft = snap(
          Math.max(
            0,
            Math.min(
              mm - margins.left,
              contentWidthMm - d.indentRight - MIN_CONTENT_MM,
            ),
          ),
        );
      } else if (dragging === "right") {
        d.indentRight = snap(
          Math.max(
            0,
            Math.min(
              pageWidthMm - margins.right - mm,
              contentWidthMm - d.indentLeft - MIN_CONTENT_MM,
            ),
          ),
        );
      } else {
        const rel = mm - margins.left - d.indentLeft;
        const maxVal =
          contentWidthMm - d.indentLeft - d.indentRight;
        d.textIndent = snap(
          Math.max(-d.indentLeft, Math.min(rel, maxVal)),
        );
      }

      draftRef.current = d;
      setIndents(d);
    };

    const onUp = () => {
      draggingRef.current = null;
      setDragging(null);
      const d = draftRef.current;
      editor
        .chain()
        .focus()
        .command(({ tr, state }) => {
          const { from, to } = state.selection;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (
              node.type.name === "paragraph" ||
              node.type.name === "heading"
            ) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indentLeft: d.indentLeft,
                indentRight: d.indentRight,
                textIndent: d.textIndent,
              });
            }
          });
          return true;
        })
        .run();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, editor, zoom, margins, pageWidthMm, contentWidthMm]);

  const { tickPath, labels } = useMemo(() => {
    let path = "";
    const lbls: { x: number; text: string }[] = [];
    const minStep = zoom >= 0.6 ? 1 : zoom >= 0.4 ? 5 : 10;

    for (let mm = 0; mm <= pageWidthMm; mm += minStep) {
      const x = mmToPx(mm);
      let h: number;

      if (mm % 10 === 0) {
        h = RULER_H * 0.45;
        const inContent =
          mm > margins.left && mm < pageWidthMm - margins.right;
        if (inContent) {
          lbls.push({ x, text: String((mm - margins.left) / 10) });
        }
      } else if (mm % 5 === 0) {
        h = RULER_H * 0.22;
      } else {
        h = RULER_H * 0.1;
      }

      path += `M${x.toFixed(1)} ${RULER_H}V${(RULER_H - h).toFixed(1)}`;
    }

    return { tickPath: path, labels: lbls };
  }, [pageWidthMm, margins, zoom, mmToPx]);

  if (!editor) return null;

  const leftMarginPx = mmToPx(margins.left);
  const rightMarginPx = mmToPx(margins.right);

  return (
    <div
      ref={rulerRef}
      className="editor-ruler mx-auto relative select-none"
      style={{ width: totalWidth, height: RULER_H }}
    >
      {/* Margin zones */}
      <div
        className="absolute inset-y-0 left-0 ruler-margin-zone"
        style={{ width: leftMarginPx }}
      />
      <div
        className="absolute inset-y-0 right-0 ruler-margin-zone"
        style={{ width: rightMarginPx }}
      />

      {/* Tick marks */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={totalWidth}
        height={RULER_H}
        aria-hidden="true"
      >
        <path
          d={tickPath}
          fill="none"
          className="ruler-tick-path"
          strokeWidth={0.5}
        />
        {labels.map((l) => (
          <text
            key={l.x}
            x={l.x}
            y={RULER_H * 0.42}
            textAnchor="middle"
            fontSize={8}
            className="ruler-label"
            fontFamily="Arial, sans-serif"
          >
            {l.text}
          </text>
        ))}
      </svg>

      {/* First-line indent marker (top, downward triangle) */}
      <MarkerHandle
        x={firstLinePos}
        side="top"
        isDragging={dragging === "firstLine"}
        onMouseDown={onMarkerDown("firstLine")}
        title={`Отступ первой строки: ${indents.textIndent.toFixed(1)} мм`}
      />

      {/* Left indent marker (bottom, upward triangle) */}
      <MarkerHandle
        x={leftPos}
        side="bottom"
        isDragging={dragging === "left"}
        onMouseDown={onMarkerDown("left")}
        title={`Левый отступ: ${indents.indentLeft.toFixed(1)} мм`}
      />

      {/* Right indent marker (bottom, upward triangle) */}
      <MarkerHandle
        x={rightPos}
        side="bottom"
        isDragging={dragging === "right"}
        onMouseDown={onMarkerDown("right")}
        title={`Правый отступ: ${indents.indentRight.toFixed(1)} мм`}
      />

    </div>
  );
}

/* ── Marker triangle handle ── */

function MarkerHandle({
  x,
  side,
  isDragging,
  onMouseDown,
  title,
}: {
  x: number;
  side: "top" | "bottom";
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  title: string;
}) {
  const points =
    side === "top"
      ? `0,0 ${MARKER_W},0 ${MARKER_W / 2},${MARKER_H}`
      : `0,${MARKER_H} ${MARKER_W},${MARKER_H} ${MARKER_W / 2},0`;

  const posStyle: React.CSSProperties =
    side === "top"
      ? { top: 0, left: x - MARKER_W / 2 }
      : { bottom: 0, left: x - MARKER_W / 2 };

  const fillClass = isDragging
    ? "ruler-marker-active"
    : "ruler-marker ruler-marker-idle";

  return (
    <div
      className="absolute z-10 cursor-ew-resize"
      style={{
        ...posStyle,
        width: MARKER_W + 4,
        height: MARKER_H + 6,
        marginLeft: -2,
        padding: side === "top" ? "0 2px 6px" : "6px 2px 0",
      }}
      onMouseDown={onMouseDown}
      title={title}
    >
      <svg
        width={MARKER_W}
        height={MARKER_H}
        viewBox={`0 0 ${MARKER_W} ${MARKER_H}`}
      >
        <polygon points={points} className={fillClass} />
      </svg>
    </div>
  );
}
