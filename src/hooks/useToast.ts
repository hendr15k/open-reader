import { useState, useCallback } from 'react';

interface ToastItem {
  id: number;
  message: string;
}

let toastIdCounter = 0;

/**
 * Simple toast notification hook.
 * Returns { toasts, showToast } — toasts auto-dismiss after `duration` ms.
 */
export function useToast(duration: number = 1500) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, [duration]);

  return { toasts, showToast };
}
