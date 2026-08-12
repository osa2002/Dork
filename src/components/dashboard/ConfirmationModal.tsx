import React from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ConfirmationModalProps {
  show?: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({ 
  show = true, 
  title, 
  message, 
  confirmText, 
  cancelText,
  variant = "warning",
  onConfirm, 
  onCancel 
}: ConfirmationModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = (i18n.language || "ar").startsWith("ar");

  if (!show) return null;

  const isDanger = variant === "danger";

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" id="confirm-modal">
      <div className={`bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden transform transition-all duration-200 ${isRtl ? "text-right dir-rtl" : "text-left dir-ltr"}`}>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl shrink-0 ${
              isDanger 
                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30" 
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30"
            }`}>
              {isDanger ? <ShieldAlert className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              {title}
            </h3>
          </div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer"
            id="btn-cancel-modal"
          >
            {cancelText || t("btn_cancel", "إلغاء / Cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 text-xs font-black text-white transition-all rounded-2xl shadow-md cursor-pointer ${
              isDanger
                ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200 dark:shadow-none"
                : "bg-amber-600 hover:bg-amber-700 shadow-amber-200 dark:shadow-none"
            }`}
            id="btn-confirm-modal"
          >
            {confirmText || t("btn_confirm", "تأكيد / Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

