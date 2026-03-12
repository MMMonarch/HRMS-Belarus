"use client";

import { useState, type ComponentType } from "react";
import { ReferencesSidebar } from "@/features/references/components/ReferencesSidebar";
import { BranchesEditor } from "@/features/references/components/BranchesEditor";
import { DepartmentsEditor } from "@/features/references/components/DepartmentsEditor";
import { OrganizationsEditor } from "@/features/references/components/OrganizationsEditor";
import { PositionCategoriesEditor } from "@/features/references/components/PositionCategoriesEditor";
import { PositionSubcategoriesEditor } from "@/features/references/components/PositionSubcategoriesEditor";
import { PositionsEditor } from "@/features/references/components/PositionsEditor";
import { CountriesEditor } from "@/features/references/components/CountriesEditor";
import { DocumentTypesEditor } from "@/features/references/components/DocumentTypesEditor";
import { OrderItemSubtypesEditor } from "@/features/references/components/OrderItemSubtypesEditor";
import { OrderItemTypesEditor } from "@/features/references/components/OrderItemTypesEditor";
import { OrderTemplatesEditor } from "@/features/references/components/OrderTemplatesEditor";
import { TemplateTypesEditor } from "@/features/references/components/TemplateTypesEditor";
import type { DirectoryId } from "@/features/references/types";

const EDITOR_MAP: Record<DirectoryId, ComponentType> = {
  organizations: OrganizationsEditor,
  branches: BranchesEditor,
  departments: DepartmentsEditor,
  positions: PositionsEditor,
  position_categories: PositionCategoriesEditor,
  position_subcategories: PositionSubcategoriesEditor,
  template_types: TemplateTypesEditor,
  order_templates: OrderTemplatesEditor,
  order_item_types: OrderItemTypesEditor,
  order_item_subtypes: OrderItemSubtypesEditor,
  document_types: DocumentTypesEditor,
  countries: CountriesEditor,
};

export default function ReferencesPage() {
  const [selectedDirectory, setSelectedDirectory] = useState<DirectoryId | null>(
    "organizations"
  );

  const Editor = selectedDirectory ? EDITOR_MAP[selectedDirectory] : null;

  return (
    <div className="flex h-[calc(100vh-3.5rem-3rem)] min-h-0">
      <ReferencesSidebar
        selectedId={selectedDirectory}
        onSelect={setSelectedDirectory}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        {Editor ? (
          <Editor />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Выберите справочник в списке слева
          </div>
        )}
      </main>
    </div>
  );
}
