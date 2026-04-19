import { cn } from '@/utils/cn';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, icon, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={cn(
            'w-full rounded-lg border px-3 py-2.5 text-sm',
            // Light
            'border-gray-300 bg-white text-gray-900 placeholder-gray-400',
            // Dark
            'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500',
            // Focus
            'focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20',
            'dark:focus:border-orange-400 dark:focus:ring-orange-400/20',
            // Disabled
            'disabled:bg-gray-50 disabled:cursor-not-allowed',
            'dark:disabled:bg-slate-900 dark:disabled:text-slate-500',
            // Error
            error && 'border-red-400 focus:border-red-400 focus:ring-red-400/20',
            icon && 'pl-10',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
