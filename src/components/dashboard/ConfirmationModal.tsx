import React from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ConfirmationModalProps {
  show?: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({ show = true, title, message, onConfirm, onCancel }: ConfirmationModalProps) {
  const { t } = useTranslation();
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" id="confirm-modal">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden transform scale-100 transition-all">
        <div className="p-6">
          <div className="flex items-center gap-4 text-amber-600 mb-4">
            <div className="p-3 bg-amber-50 rounded-full">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 font-sans">{title}</h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed font-sans">{message}</p>
        </div>
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors bg-white hover:bg-gray-50 border border-gray-200 rounded-xl"
            id="btn-cancel-modal"
          >
            {t("btn_cancel", "Cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors rounded-xl shadow-sm"
            id="btn-confirm-modal"
          >
            {t("btn_confirm", "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
