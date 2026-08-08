"use client";

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, description, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 py-6 sm:items-center">
      <div className="w-full max-w-lg overflow-hidden rounded-t-[28px] bg-surface shadow-2xl sm:rounded-[28px]">
        <div className="flex items-start justify-between border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-xl font-semibold text-ink">{title}</h2>
            {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-ink transition hover:bg-bg"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        <div className="space-y-6 px-5 py-6 sm:px-6">{children}</div>

        {footer ? <div className="border-t border-line px-5 py-4 sm:px-6">{footer}</div> : null}
      </div>
    </div>
  );
}
