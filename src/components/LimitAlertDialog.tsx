import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface LimitAlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isRtl: boolean;
}

export const LimitAlertDialog: React.FC<LimitAlertDialogProps> = ({
  isOpen,
  onClose,
  isRtl,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      id="limit-alert-dialog"
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-5 transform scale-100 transition-all animate-scaleIn relative overflow-hidden">
        {/* Subtle decorative background pattern/gradient */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500" />
        
        {/* Close Button on Top Corner */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer p-1 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Warning Icon Container */}
        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex items-center justify-center text-amber-500 dark:text-amber-400 mx-auto mt-2 shadow-inner">
          <AlertTriangle className="w-9 h-9 animate-bounce duration-1000" />
        </div>
        
        {/* Message Content */}
        <div className="space-y-2">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            {isRtl ? "عذراً، الطابور ممتلئ لليوم" : "Queue Limit Reached"}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed px-2">
            {isRtl 
              ? "لقد وصلت الباقة لهذا المحل إلى الحد الأقصى اليوم (5 عملاء). يرجى التواصل مع إدارة المحل للحصول على الدعم والمساعدة."
              : "This shop's plan limit has reached its maximum for today (5 customers). Please contact the shop administration for assistance."}
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            id="close-limit-modal-btn"
            onClick={onClose}
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold text-xs py-3.5 rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-100 dark:shadow-none active:scale-98 cursor-pointer"
          >
            <span>{isRtl ? "حسناً" : "Okay"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
