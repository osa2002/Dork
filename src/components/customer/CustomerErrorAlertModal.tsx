import React from "react";
import { useTranslation } from "react-i18next";
import { XCircle, AlertCircle } from "lucide-react";

interface CustomerErrorAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorMessage: string;
}

export function CustomerErrorAlertModal({
  isOpen,
  onClose,
  errorMessage
}: CustomerErrorAlertModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div 
      id="error-alert-dialog"
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-5 transform scale-100 transition-all animate-scaleIn relative overflow-hidden">
        {/* Rose alert indicator top line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-red-500 to-rose-500" />
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer p-1 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800"
          aria-label="Close"
        >
          <XCircle className="w-5 h-5" />
        </button>

        {/* Warning / Error icon container */}
        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center justify-center text-rose-500 dark:text-rose-400 mx-auto mt-2 shadow-inner">
          <AlertCircle className="w-9 h-9 text-rose-500 animate-pulse" />
        </div>
        
        {/* Error details */}
        <div className="space-y-2">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            {t("customer_alert_title")}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed px-2 whitespace-pre-line">
            {errorMessage}
          </p>
        </div>

        {/* Confirmation button */}
        <div className="pt-2">
          <button
            id="close-error-modal-btn"
            onClick={onClose}
            className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-extrabold text-xs py-3.5 rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-rose-100 dark:shadow-none active:scale-98 cursor-pointer"
          >
            <span>{t("customer_ok_btn")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
