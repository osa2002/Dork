import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { XCircle, Smartphone } from "lucide-react";

interface CustomerPwaModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRtl: boolean;
}

export function CustomerPwaModal({ isOpen, onClose, isRtl }: CustomerPwaModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />
      
      {/* Modal Content */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.35 }}
        className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 text-center space-y-4"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-1.5 rounded-full transition-all cursor-pointer"
        >
          <XCircle className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
            <Smartphone className="w-6 h-6 animate-pulse" />
          </div>

          <h3 className="text-base font-black text-slate-900 dark:text-white">
            {isRtl ? "تثبيت تطبيق 'دورك'" : "Install 'Dork' App"}
          </h3>
          
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-1.5 max-w-[280px]">
            {isRtl 
              ? "تابع طابور الانتظار وتذكرتك مباشرة من شاشتك الرئيسية في أي وقت وبسرعة فائقة!"
              : "Track queue status and your ticket directly from your home screen in one click!"}
          </p>
        </div>

        {/* Instructions container */}
        <div className="bg-slate-50 dark:bg-slate-950/30 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 space-y-3">
          <div className={`text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider ${isRtl ? "text-right" : "text-left"}`}>
            {isRtl ? "خطوات التثبيت البسيطة" : "Quick Installation Steps"}
          </div>
          {/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) ? (
            <p className={`text-[11px] leading-relaxed font-bold ${isRtl ? "text-right" : "text-left"}`}>
              {isRtl ? (
                <>
                  ١. اضغط على زر المشاركة <span className="inline-block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">⎋</span> في شريط Safari السفلي.
                  <br />
                  ٢. اختر <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">"إضافة إلى الشاشة الرئيسية"</span> <span className="inline-block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">⊕</span> من قائمة الخيارات.
                </>
              ) : (
                <>
                  1. Tap the Share button <span className="inline-block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">⎋</span> at Safari's bottom bar.
                  <br />
                  2. Select <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">"Add to Home Screen"</span> <span className="inline-block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">⊕</span> from the list.
                </>
              )}
            </p>
          ) : (
            <p className={`text-[11px] leading-relaxed font-bold ${isRtl ? "text-right" : "text-left"}`}>
              {isRtl ? (
                <>
                  ١. اضغط على زر الخيارات الثلاث نقاط <span className="font-extrabold">⋮</span> في زاوية المتصفح العليا.
                  <br />
                  ٢. اختر <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">"تثبيت التطبيق"</span> أو <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">"إضافة إلى الشاشة الرئيسية"</span> من القائمة المنسدلة.
                </>
              ) : (
                <>
                  1. Tap the browser options menu <span className="font-extrabold">⋮</span> at the corner.
                  <br />
                  2. Select <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">"Install App"</span> or <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">"Add to Home Screen"</span>.
                </>
              )}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-850 text-white font-extrabold text-xs py-3.5 rounded-2xl transition-all shadow-md shadow-indigo-100 dark:shadow-none cursor-pointer"
        >
          {isRtl ? "فهمت" : "Got it!"}
        </button>
      </motion.div>
    </div>
  );
}
