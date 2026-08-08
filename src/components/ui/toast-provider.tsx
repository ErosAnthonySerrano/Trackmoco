"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

type ToastVariant = 'default' | 'success' | 'danger';

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastOptions = Omit<Toast, 'id'>;

type ToastContextValue = {
  toast: (options: ToastOptions) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function getVariantStyles(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return 'border-success text-success bg-success-soft';
    case 'danger':
      return 'border-danger text-danger bg-danger-soft';
    default:
      return 'border-line text-ink bg-surface';
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `toast-${Date.now()}`;

    const nextToast: Toast = { id, variant: 'default', ...options };
    setToasts((current) => [nextToast, ...current]);

    window.setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3 px-2 sm:px-0">
        {toasts.map(({ id, title, description, variant = 'default' }) => (
          <div
            key={id}
            className={clsx('overflow-hidden rounded-3xl border px-4 py-3 shadow-lg', getVariantStyles(variant))}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">{title}</p>
                {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(id)}
                className="rounded-full p-1 text-ink transition hover:bg-bg"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Dismiss notification</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
