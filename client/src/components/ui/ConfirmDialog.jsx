import { TriangleAlert } from 'lucide-react';

import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';

/**
 * Confirmation step for destructive actions.
 *
 * It says what is about to be deleted, marks itself as destructive in three
 * ways that do not depend on colour alone (the warning icon, the wording, and a
 * filled danger button), and keeps the confirm button disabled while the request
 * is in flight so an action cannot be fired twice.
 *
 * Once the request is running, the dialog is committed: Escape, the backdrop and
 * the close button are ignored until it answers, so a delete cannot be "cancelled"
 * halfway through by a stray click and leave the user unsure whether it happened.
 */
export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isLoading = false,
  tone = 'danger',
}) => (
  <Modal
    open={open}
    onClose={() => {
      if (!isLoading) onClose?.();
    }}
    title={title}
    size="sm"
    tone={tone}
    footer={
      <>
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={isLoading}
          className={isLoading ? 'pointer-events-none' : undefined}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={tone === 'danger' ? 'danger' : 'primary'}
          icon={tone === 'danger' ? TriangleAlert : undefined}
          onClick={onConfirm}
          isLoading={isLoading}
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="flex items-start gap-3">
      {tone === 'danger' ? (
        <span className="grid size-10 shrink-0 place-items-center rounded-chip bg-danger/10 text-danger">
          <TriangleAlert className="size-5" aria-hidden="true" />
        </span>
      ) : null}
      <p className="text-body leading-relaxed text-muted">{description}</p>
    </div>
  </Modal>
);
