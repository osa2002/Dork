import React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { XCircle, Bell } from "lucide-react";

interface CustomerInAppAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: string;
  title: string;
  message: string;
  isRtl: boolean;
}

export function CustomerInAppAlertModal({
  isOpen,
  onClose,
  type,
  title,
  message,
  isRtl
}: CustomerInAppAlertModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />
      
      {/* Modal Content */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="relative w-full max-w-sm bg-white dark:bg-slate-900 border-2 border-indigo-500/30 dark:border-indigo-500/40 rounded-3xl p-6 shadow-2xl z-10 text-center space-y-4 animate-pulse-border"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 end-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-1.5 rounded-full transition-all cursor-pointer"
        >
          <XCircle className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center">
          {/* Pulsing Bell/Notification Icon */}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-lg ${
            type === "next" 
              ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 shadow-rose-100 dark:shadow-none" 
              : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shadow-amber-100 dark:shadow-none"
          }`}>
            <Bell className="w-7 h-7 animate-bounce" />
          </div>

          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            {title}
          </h3>
          
          <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed mt-2 max-w-[290px]">
            {message}
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className={`w-full text-white font-extrabold text-xs py-3.5 rounded-2xl transition-all shadow-md cursor-pointer ${
              type === "next"
                ? "bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-850 shadow-rose-100 dark:shadow-none"
                : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-750 shadow-amber-100 dark:shadow-none"
            }`}
          >
            {isRtl ? "حاضر، أنا مستعد! 👍" : "I am ready! 👍"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
