import { useEffect, useRef } from "react";
import { useLocale } from "@/lib/i18n";

type Props = {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useLocale();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Capture the previously-focused element so we can restore on close.
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    return () => {
      triggerRef.current?.focus?.();
    };
  }, [open]);

  // ESC closes; Enter on the dialog confirms (the focused button handles
  // its own Enter, this is a belt-and-braces guard).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="confirm-overlay"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={body ? "confirm-body" : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="confirm-title">
          {title}
        </h2>
        {body && (
          <p id="confirm-body" className="confirm-body">
            {body}
          </p>
        )}
        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-cancel"
            onClick={onCancel}
          >
            {cancelLabel ?? t("confirm.cancel")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`confirm-ok confirm-ok--${variant}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
