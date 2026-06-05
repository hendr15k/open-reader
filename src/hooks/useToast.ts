import { useState, useCallback, useEffect, useRef } from 'react';

interface ToastItem {
  id: number;
  message: string;
}

let toastIdCounter = 0;

/**
 * Simple toast notification hook.
 * Returns { toasts, showToast } — toasts auto-dismiss after `duration` ms.
 *
 * Timers are tracked in a ref so they can be cleared on unmount — otherwise
 * `setToasts` would fire on an unmounted component (no-op in React 18, but a
 * real leak) when the user navigated away mid-toast.
 */
export function useToast(duration: number = 1500) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    return () => {
      // Clear every pending dismissal timer on unmount.
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const showToast = useCallback((message: string) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message }]);
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
    timersRef.current.add(timer);
  }, [duration]);

  return { toasts, showToast };
}
