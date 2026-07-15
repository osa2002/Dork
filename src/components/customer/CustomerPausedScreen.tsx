import React from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface CustomerPausedScreenProps {
  isRtl: boolean;
}

export function CustomerPausedScreen({ isRtl }: CustomerPausedScreenProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center shadow-lg"
    >
      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 text-amber-600">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-amber-900 mb-2">
        {t("service_paused_title", "Services Temporarily Suspended")}
      </h2>
      <p className="text-sm text-amber-700 leading-relaxed">
        {t("service_paused_desc", "The owner has temporarily paused ticket issuance. Please refresh in a moment.")}
      </p>
    </motion.div>
  );
}
