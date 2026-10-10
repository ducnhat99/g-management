'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';

/**
 * Centered dialog on desktop, bottom sheet on phones. Escape, the ✕ button or a backdrop click
 * closes it. On open, focus goes to the first field (or the first button when there is none).
 */
export function Modal({
  open,
  title,
  description,
  icon,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  /** Shown left of the title, e.g. a tinted icon badge. */
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  // Latest onClose without re-running the effects below on every render (that would steal focus).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const body = bodyRef.current;
    (body?.querySelector<HTMLElement>('input, textarea') ?? body?.querySelector('button'))?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-stone-900/40 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative max-h-[92vh] w-full animate-modal-in overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl"
      >
        {/* Grab handle: phones only, where the dialog is a bottom sheet. */}
        <div
          aria-hidden="true"
          className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-stone-200 sm:hidden"
        />

        <div className="flex items-start gap-3 px-5 pt-4 sm:px-6 sm:pt-6">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-stone-900">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-sm text-stone-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="-mt-1 -mr-2 rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div ref={bodyRef} className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
