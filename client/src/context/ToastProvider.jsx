import { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';

import { ToastContext } from './toastContext.js';
import { cx } from '../utils/cx.js';

/**
 * Four tones, one shape: a colour bar, an icon, a title and a sentence. The icon
 * carries the meaning as well as the colour, so a toast still reads correctly
 * without relying on hue.
 */
const TONES = {
  success: { icon: CheckCircle2, accent: 'text-success', bar: 'bg-success' },
  error: { icon: XCircle, accent: 'text-danger', bar: 'bg-danger' },
  warning: { icon: TriangleAlert, accent: 'text-warning-ink', bar: 'bg-warning' },
  info: { icon: Info, accent: 'text-info', bar: 'bg-info' },
};

const DEFAULT_DURATION = 5000;
const MAX_VISIBLE = 4;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const prefersReducedMotion = useReducedMotion();

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    ({ tone = 'info', title, message, duration = DEFAULT_DURATION }) => {
      const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

      setToasts((current) => [...current, { id, tone, title, message }].slice(-MAX_VISIBLE));

      if (duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), duration));
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toast: push,
      success: (message, title = 'Done') => push({ tone: 'success', title, message }),
      error: (message, title = 'Something went wrong') => push({ tone: 'error', title, message }),
      warning: (message, title = 'Heads up') => push({ tone: 'warning', title, message }),
      info: (message, title = 'Note') => push({ tone: 'info', title, message }),
      dismiss,
    }),
    [dismiss, push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[100] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[380px]"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const { icon: Icon, accent, bar } = TONES[toast.tone] ?? TONES.info;

            // Stacking is a layout change, so the remaining toasts slide up
            // when one is dismissed; under reduced motion they simply close the
            // gap. The entrance is short and ease-out with no overshoot: a
            // confirmation has already happened and should not look like a
            // celebration.
            return (
              <motion.div
                key={toast.id}
                layout={!prefersReducedMotion}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.99 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-auto relative overflow-hidden rounded-panel border border-line/80 bg-surface shadow-raised"
              >
                <span className={cx('absolute inset-y-0 left-0 w-1', bar)} aria-hidden="true" />

                <div className="flex items-start gap-3 py-3.5 pr-3 pl-4">
                  <Icon className={cx('mt-0.5 size-5 shrink-0', accent)} aria-hidden="true" />

                  <div className="min-w-0 flex-1">
                    <p className="text-body font-semibold text-ink">{toast.title}</p>
                    {toast.message ? (
                      <p className="mt-0.5 text-label leading-relaxed text-muted">{toast.message}</p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    className="focus-ring rounded-md p-1 text-muted transition-colors hover:bg-beige/50 hover:text-ink"
                    aria-label="Dismiss notification"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
