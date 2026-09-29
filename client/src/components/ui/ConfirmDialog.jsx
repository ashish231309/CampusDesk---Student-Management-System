import { TriangleAlert } from 'lucide-react';

import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';

/**
 * Confirmation step for destructive actions. The confirm button stays disabled
 * while the request is in flight so an action cannot be fired twice.
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
    onClose={onClose}
    title={title}
    size="sm"
    tone={tone}
    footer={
      <>
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === 'danger' ? 'danger' : 'primary'}
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
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
          <TriangleAlert className="size-5" aria-hidden="true" />
        </span>
      ) : null}
      <p className="text-sm leading-relaxed text-muted">{description}</p>
    </div>
  </Modal>
);
