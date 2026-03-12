"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCrud } from "@/lib/n8n/use-crud";
import { useWorkspaceOptional } from "@/lib/context/workspace";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export type AddCandidateFormData = {
  lastName: string;
  firstName: string;
  patronymic: string;
  contactPhone?: string;
  contactEmail?: string;
  organizationId: string;
  branchId: string;
};

type AddCandidateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: AddCandidateFormData) => void;
};

export function AddCandidateModal({
  open,
  onOpenChange,
  onAdd,
}: AddCandidateModalProps) {
  const crudWithBase = useCrud();
  const workspace = useWorkspaceOptional();
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [patronymic, setPatronymic] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastAddedData, setLastAddedData] = useState<AddCandidateFormData | null>(null);

  const branchId = workspace?.branchId ?? null;
  const organizationId = workspace?.organizationId ?? "";

  useEffect(() => {
    if (open) {
      setLastName("");
      setFirstName("");
      setPatronymic("");
      setContactPhone("");
      setContactEmail("");
      setError(null);
      setShowSuccess(false);
      setLastAddedData(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!lastName.trim() || !firstName.trim()) return;
    if (!branchId) {
      setError("Сначала выберите филиал для работы");
      return;
    }
    const formData: AddCandidateFormData = {
      lastName: lastName.trim(),
      firstName: firstName.trim(),
      patronymic: patronymic.trim(),
      contactPhone: contactPhone.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      organizationId,
      branchId,
    };
    setSubmitting(true);
    setError(null);
    try {
      // Все поля таблицы persons: из формы или пустые (для вебхука/n8n).
      await crudWithBase("persons", "create", {
        branch_id: branchId,
        person_no: null,
        last_name: formData.lastName,
        first_name: formData.firstName,
        patronymic: formData.patronymic || null,
        birth_date: null,
        gender: null,
        citizenship_id: null,
        contact_phone: formData.contactPhone ?? null,
        contact_email: formData.contactEmail ?? null,
        created_at: null,
        updated_at: null,
        created_by: null,
        updated_by: null,
      });
      setLastAddedData(formData);
      setShowSuccess(true);
      toast.success("Кандидат успешно добавлен");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка при добавлении кандидата");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {showSuccess ? "Готово" : "Добавление кандидата"}
          </DialogTitle>
        </DialogHeader>
        {showSuccess ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6">
            <CheckCircle2 className="size-12 text-green-600" aria-hidden />
            <p className="text-center text-sm font-medium text-foreground">
              Кандидат успешно добавлен
            </p>
            <Button
              onClick={() => {
                if (lastAddedData) onAdd(lastAddedData);
                onOpenChange(false);
              }}
            >
              ОК
            </Button>
          </div>
        ) : (
        <div className="flex flex-col gap-4">
          {/* Фамилия, Имя, Отчество */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Фамилия</label>
              <Input
                placeholder="Фамилия"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Имя</label>
              <Input
                placeholder="Имя"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Отчество</label>
              <Input
                placeholder="Отчество"
                value={patronymic}
                onChange={(e) => setPatronymic(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {/* Контакт (для связи с кандидатом) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Телефон</label>
              <Input
                type="tel"
                placeholder="+375 ..."
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Желательно указать хотя бы один контакт для связи
          </p>

          {!branchId && (
            <p className="text-xs text-muted-foreground">
              <Link href="/select-workspace" className="text-primary underline">
                Выберите филиал для работы
              </Link>
              , чтобы добавить кандидата.
            </p>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={
                !lastName.trim() ||
                !firstName.trim() ||
                !branchId ||
                isSubmitting
              }
            >
              {isSubmitting ? "Отправка…" : "Добавить"}
            </Button>
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
