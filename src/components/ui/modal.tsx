"use client";

import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-4 backdrop-blur-sm sm:py-6">
      <div className="my-auto flex max-h-[calc(100dvh-2rem)] w-full min-h-0 flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl sm:max-h-[90vh] sm:max-w-lg">
        <div className="flex shrink-0 items-start justify-between border-b border-line px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-ink-muted hover:bg-accent-soft transition"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        <div className="theme-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">{children}</div>
        </div>

        {footer ? <div className="border-t border-line px-6 py-5 bg-bg">{footer}</div> : null}
      </div>
    </div>
    ),
    document.body
  );
}

