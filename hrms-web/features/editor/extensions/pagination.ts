import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";

const SPACER_ATTR = "data-page-break-spacer";

export interface PaginationConfig {
  pageHeightPx: number;
  marginTopPx: number;
  marginBottomPx: number;
  gapPx: number;
}

export const paginationKey = new PluginKey<DecorationSet>("pagination");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pagination: {
      updatePagination: (cfg: Partial<PaginationConfig>) => ReturnType;
    };
  }
}

export const Pagination = Extension.create<object, PaginationConfig>({
  name: "pagination",

  addStorage() {
    return {
      pageHeightPx: 1122.52,
      marginTopPx: 75.59,
      marginBottomPx: 75.59,
      gapPx: 32,
    };
  },

  addCommands() {
    return {
      updatePagination:
        (cfg) =>
        ({ editor, tr, dispatch }) => {
          const s = (editor.storage as unknown as Record<string, PaginationConfig>)
            .pagination;
          Object.assign(s, cfg);
          if (dispatch) {
            tr.setMeta(paginationKey, { recalc: true });
            tr.setMeta("addToHistory", false);
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const storage = (
      this.editor.storage as unknown as Record<string, PaginationConfig>
    ).pagination;

    return [
      new Plugin<DecorationSet>({
        key: paginationKey,

        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, value) {
            const meta = tr.getMeta(paginationKey);
            if (meta?.deco) return meta.deco as DecorationSet;
            if (tr.docChanged || meta?.recalc) {
              return DecorationSet.empty;
            }
            return value;
          },
        },

        props: {
          decorations(state) {
            return paginationKey.getState(state) ?? DecorationSet.empty;
          },
        },

        view(editorView: EditorView) {
          let rafId: number | null = null;
          let prevKey = "";

          function measure() {
            rafId = null;
            const dom = editorView.dom;
            if (!dom?.isConnected) return;

            const contentAreaH =
              storage.pageHeightPx - storage.marginTopPx - storage.marginBottomPx;
            if (contentAreaH <= 0) return;

            const breakVisualH =
              storage.marginBottomPx + storage.gapPx + storage.marginTopPx;

            const children = Array.from(dom.children) as HTMLElement[];

            const firstContent = children.find(
              (c) => !c.hasAttribute(SPACER_ATTR),
            );
            const tiptapTop =
              firstContent && firstContent.offsetParent === dom
                ? 0
                : dom.offsetTop;

            let cumulativeSpacerH = 0;
            let currentPageBottom = contentAreaH;
            let pageNum = 1;
            let prevBlockEnd = 0;

            interface SpacerDef {
              pos: number;
              height: number;
              remaining: number;
              pageNum: number;
            }
            const spacers: SpacerDef[] = [];

            for (const child of children) {
              if (child.hasAttribute(SPACER_ATTR)) {
                cumulativeSpacerH += child.offsetHeight;
                continue;
              }

              const contentY =
                child.offsetTop - tiptapTop - cumulativeSpacerH;
              const blockH = child.offsetHeight;

              if (contentY >= currentPageBottom) {
                const remaining = Math.max(
                  0,
                  currentPageBottom - prevBlockEnd,
                );
                const spacerH = remaining + breakVisualH;

                let pos: number;
                try {
                  pos = editorView.posAtDOM(child, 0) - 1;
                } catch {
                  pageNum++;
                  currentPageBottom = contentY + contentAreaH;
                  prevBlockEnd = contentY + blockH;
                  continue;
                }
                if (pos >= 0) {
                  pageNum++;
                  spacers.push({ pos, height: spacerH, remaining, pageNum });
                  currentPageBottom = contentY + contentAreaH;
                } else {
                  pageNum++;
                  currentPageBottom = contentY + contentAreaH;
                }
              } else if (
                contentY + blockH > currentPageBottom &&
                contentY < currentPageBottom
              ) {
                const remaining = currentPageBottom - contentY;
                const spacerH = remaining + breakVisualH;

                let pos: number;
                try {
                  pos = editorView.posAtDOM(child, 0) - 1;
                } catch {
                  continue;
                }
                if (pos < 0) continue;

                pageNum++;
                spacers.push({ pos, height: spacerH, remaining, pageNum });
                currentPageBottom = contentY + contentAreaH;
              }

              prevBlockEnd = contentY + blockH;
            }

            const editorPage = dom.closest(".editor-page") as HTMLElement | null;
            if (editorPage) {
              const fullMinH =
                pageNum * storage.pageHeightPx +
                Math.max(0, pageNum - 1) * storage.gapPx;
              editorPage.style.minHeight = `${fullMinH}px`;
            }

            const key = spacers
              .map((s) => `${s.pos}:${Math.round(s.height)}`)
              .join("|");
            if (key === prevKey) return;
            prevKey = key;

            const decorations = spacers.map((s) =>
              Decoration.widget(
                s.pos,
                () =>
                  buildSpacerDOM(
                    s.height,
                    s.remaining,
                    s.pageNum,
                    storage,
                  ),
                { side: -1, key: `pb-${s.pageNum}` },
              ),
            );

            const tr = editorView.state.tr;
            tr.setMeta(paginationKey, {
              deco: DecorationSet.create(editorView.state.doc, decorations),
            });
            tr.setMeta("addToHistory", false);
            editorView.dispatch(tr);
          }

          function schedule() {
            if (rafId != null) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(measure);
          }

          schedule();

          return {
            update() {
              if (editorView.dom.classList.contains("resize-cursor")) return;

              const decos = paginationKey.getState(editorView.state);
              if (!decos || decos === DecorationSet.empty) {
                prevKey = "";
              }
              schedule();
            },
            destroy() {
              if (rafId != null) cancelAnimationFrame(rafId);
            },
          };
        },
      }),
    ];
  },
});

function buildSpacerDOM(
  totalH: number,
  remaining: number,
  pageNum: number,
  cfg: PaginationConfig,
): HTMLElement {
  const el = document.createElement("div");
  el.className = "page-break-spacer";
  el.setAttribute(SPACER_ATTR, "");
  el.contentEditable = "false";
  el.style.height = `${totalH}px`;
  el.style.setProperty("--pb-remaining", `${remaining}px`);
  el.style.display = "flex";
  el.style.flexDirection = "column";
  el.style.justifyContent = "flex-end";

  const bottom = document.createElement("div");
  bottom.className = "page-edge-bottom";
  bottom.style.height = `${cfg.marginBottomPx}px`;

  const gap = document.createElement("div");
  gap.className = "page-gap";
  gap.style.height = `${cfg.gapPx}px`;

  const top = document.createElement("div");
  top.className = "page-edge-top";
  top.style.height = `${cfg.marginTopPx}px`;

  el.appendChild(bottom);
  el.appendChild(gap);
  el.appendChild(top);

  return el;
}
