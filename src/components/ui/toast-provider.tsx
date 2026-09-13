"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
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
      return {
        card: 'border-line bg-surface',
        rail: 'bg-success',
        icon: CheckCircle2,
        iconClass: 'text-success',
      };
    case 'danger':
      return {
        card: 'border-line bg-surface',
        rail: 'bg-danger',
        icon: AlertCircle,
        iconClass: 'text-danger',
      };
    default:
      return {
        card: 'border-line bg-surface',
        rail: 'bg-accent',
        icon: Info,
        iconClass: 'text-accent',
      };
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
          (() => {
            const styles = getVariantStyles(variant);
            const Icon = styles.icon;

            return (
              <div
                key={id}
                className={clsx('relative overflow-hidden rounded-3xl border px-4 py-3 pl-5 shadow-lg', styles.card)}
              >
                <span className={clsx('absolute inset-y-0 left-0 w-1', styles.rail)} aria-hidden="true" />
                <div className="flex items-start gap-3">
                  <Icon className={clsx('mt-0.5 h-5 w-5 shrink-0', styles.iconClass)} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{title}</p>
                    {description ? <p className="mt-1 text-sm leading-5 text-ink-muted">{description}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(id)}
                    className="shrink-0 rounded-xl p-1 text-ink-muted transition hover:bg-bg hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Dismiss notification</span>
                  </button>
                </div>
              </div>
            );
          })()
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
