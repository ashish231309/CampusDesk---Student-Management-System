import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

/** Notifications API: success / error / info / warning, each auto-dismissing. */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
};
