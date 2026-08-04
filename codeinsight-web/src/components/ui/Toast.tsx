import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  variant?: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, variant = 'success', onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const isError = variant === 'error';
  const Icon = isError ? AlertCircle : CheckCircle2;
  const iconColor = isError ? 'var(--critical)' : 'var(--success)';

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 text-white text-xs font-medium"
      style={{
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--ink)',
        border: '1px solid #34302C',
        boxShadow: '0 8px 32px rgba(33, 31, 29, 0.3)',
      }}
      role="alert"
      aria-live="assertive"
    >
      <Icon className="w-4 h-4 shrink-0" style={{ color: iconColor }} />
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="focus-ring p-1 text-[#A8A29E] hover:text-white transition-colors cursor-pointer"
        style={{ borderRadius: 'var(--radius-sm)' }}
        aria-label="Close notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
