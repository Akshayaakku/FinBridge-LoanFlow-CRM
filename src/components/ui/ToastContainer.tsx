import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useCrmData } from '../../context/CrmDataContext';

export function ToastContainer() {
  const { toasts, dismissToast } = useCrmData();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="crm-anim-fade pointer-events-auto flex items-start gap-3 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl p-3.5 shadow-[0_10px_30px_rgba(15,23,42,0.12)] text-slate-900"
        >
          {t.type === 'success' && (
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
          {t.type === 'error' && (
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
          )}
          {t.type === 'info' && (
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Info className="w-4 h-4" />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-xs font-semibold text-slate-900">{t.title}</p>
            {t.message && <p className="text-xs text-slate-600 mt-0.5 break-words leading-relaxed">{t.message}</p>}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
