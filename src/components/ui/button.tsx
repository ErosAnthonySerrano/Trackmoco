"use client";

import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-[#111] border border-transparent',
  secondary: 'bg-surface text-ink border border-line hover:bg-accent-soft',
  ghost: 'bg-transparent text-ink hover:bg-bg border border-transparent',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, isLoading, variant = 'primary', disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={props.type ?? 'button'}
        className={clsx(
          'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-60',
          variantStyles[variant],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex h-5 w-5 items-center justify-center">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
