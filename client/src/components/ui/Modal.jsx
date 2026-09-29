import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

import { cx } from '../../utils/cx.js';
import { IconButton } from './Button.jsx';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog.
 *
 * Escape closes it, the page behind stops scrolling, focus moves into the panel
 * on open and returns to whatever opened it on close, and Tab is kept inside the
 * panel while it is up. The panel is a bottom sheet on phones and a centred card
 * from small screens up, which is the shape each size actually wants.
 *
 * The motion here is deliberately secondary to that behaviour: a short ease-out
 * of the panel and a fade of the backdrop, in and out. Nothing about opening or
 * closing a dialog depends on the animation finishing — focus is placed in the
 * same tick, Escape works immediately, and a dialog raised inside another one
 * (the delete confirmation lives on the detail screen) enters on top of it.
 */
export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  tone = 'default',
}) => {
  const panelRef = useRef(null);
  const titleId = 'campusdesk-modal-title';
  const descriptionId = 'campusdesk-modal-description';

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        onClose?.();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null,
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [handleKeyDown, open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-charcoal/45 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          <div className="pointer-events-none fixed inset-0 z-[95] flex items-end justify-center p-3 sm:items-center sm:p-6">
            <motion.div
              key="panel"
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={description ? descriptionId : undefined}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.985 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={cx(
                'pointer-events-auto w-full rounded-panel border border-line/70 bg-surface shadow-overlay outline-none',
                SIZES[size] ?? SIZES.md,
              )}
            >
              <header className="flex items-start justify-between gap-4 border-b border-line/60 px-panel py-4">
                <div className="min-w-0">
                  <h2 id={titleId} className="text-heading font-semibold text-ink">
                    {title}
                  </h2>
                  {description ? (
                    <p id={descriptionId} className="mt-1 text-label leading-relaxed text-muted">
                      {description}
                    </p>
                  ) : null}
                </div>

                <IconButton icon={X} label="Close dialog" onClick={onClose} />
              </header>

              {children ? <div className="px-panel py-4">{children}</div> : null}

              {footer ? (
                <footer
                  className={cx(
                    'flex flex-col-reverse gap-2 border-t border-line/60 px-panel py-4 sm:flex-row sm:justify-end',
                    tone === 'danger' && 'bg-danger/[0.04]',
                  )}
                >
                  {footer}
                </footer>
              ) : null}
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};
