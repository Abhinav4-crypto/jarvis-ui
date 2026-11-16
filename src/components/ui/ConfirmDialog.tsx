import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-500/25 bg-white dark:bg-[#121114] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2
              id="confirm-dialog-title"
              className="text-lg font-semibold text-[#171411] dark:text-[#FAF6EE]"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {description}
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
