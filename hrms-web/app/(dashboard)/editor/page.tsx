"use client";

import { Suspense } from "react";
import { EditorPage } from "@/features/editor/components/EditorPage";

export default function EditorRoute() {
  return (
    <div className="h-full overflow-hidden">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Загрузка редактора…
          </div>
        }
      >
        <EditorPage />
      </Suspense>
    </div>
  );
}
