"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { EmployeeDetail } from "@/features/employees/types";

/** URL фото: из photo_url или из photo_path + base URL (NEXT_PUBLIC_STORAGE_PHOTOS_BASE_URL). */
export function getPhotoDisplayUrl(employee: EmployeeDetail | null): string | null {
  if (!employee) return null;
  if (employee.photo_url) return employee.photo_url;
  const base = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_STORAGE_PHOTOS_BASE_URL : undefined;
  if (base && employee.photo_path) {
    const path = employee.photo_path.startsWith("/") ? employee.photo_path.slice(1) : employee.photo_path;
    return `${base.replace(/\/$/, "")}/${path}`;
  }
  return null;
}

export function PersonPhotoBlock({
  employee,
  onUploadPhoto,
  testMode,
}: {
  employee: EmployeeDetail | null;
  onUploadPhoto?: (personId: string, file: File, branchId: string) => void | Promise<void>;
  testMode?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const photoUrl = getPhotoDisplayUrl(employee);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !employee?.id || !onUploadPhoto) {
        if (!onUploadPhoto) toast.error("Загрузка фото недоступна");
        return;
      }
      const branchId = employee.branch_id;
      if (!branchId) {
        toast.error("Не определён филиал сотрудника");
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Выберите файл изображения (JPG, PNG и т.д.)");
        return;
      }
      setUploading(true);
      try {
        await onUploadPhoto(employee.id, file, branchId);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка загрузки фото");
      } finally {
        setUploading(false);
      }
    },
    [employee?.id, employee?.branch_id, onUploadPhoto]
  );

  const containerClass =
    "size-full max-h-full max-w-full aspect-square rounded-md border border-border overflow-hidden flex items-center justify-center bg-muted/50 text-xs text-muted-foreground";

  if (photoUrl) {
    return (
      <div className={cn(containerClass, "border-solid relative")}>
        <img
          src={photoUrl}
          alt={`Фото: ${employee?.fullName ?? "Сотрудник"}`}
          className="size-full object-cover"
        />
        {onUploadPhoto && employee && (
          <label
            htmlFor="person-photo-replace-input"
            className="absolute bottom-1 right-1 rounded bg-background/80 px-2 py-1 text-xs shadow-sm hover:bg-background"
          >
            {uploading ? "Загрузка…" : `Заменить${testMode ? " (тест)" : ""}`}
            <input
              id="person-photo-replace-input"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={handleFileChange}
            />
          </label>
        )}
      </div>
    );
  }

  return (
    <div className={cn(containerClass, "border-dashed relative")}>
      <div className="flex flex-col items-center gap-2">
        <span>Фото сотрудника</span>
        {onUploadPhoto && employee && (
          <label
            htmlFor="person-photo-upload-input"
            className="cursor-pointer rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
          >
            {uploading ? "Загрузка…" : `Загрузить фото${testMode ? " (тест)" : ""}`}
            <input
              id="person-photo-upload-input"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={handleFileChange}
            />
          </label>
        )}
      </div>
    </div>
  );
}
