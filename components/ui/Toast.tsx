
import React, { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

export interface ToastMessage {
  message: string;
  type: 'success' | 'error';
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

/** Toast de feedback visual — auto-dismiss em 4s, suporta success/error. */
export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 px-5 py-4 rounded-xl shadow-lg max-w-sm border animate-fade-in ${
        isSuccess
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-800'
      }`}
    >
      {isSuccess
        ? <CheckCircle size={20} className="text-green-600 mt-0.5 shrink-0" />
        : <XCircle size={20} className="text-red-600 mt-0.5 shrink-0" />
      }
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="opacity-50 hover:opacity-100 transition-opacity ml-1 mt-0.5"
        aria-label="Fechar"
      >
        <X size={16} />
      </button>
    </div>
  );
};
