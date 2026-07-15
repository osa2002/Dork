import React from "react";
import { useTranslation } from "react-i18next";
import { Clock, CalendarDays } from "lucide-react";
import { motion } from "motion/react";
import { Shop } from "../../types";

interface CustomerClosedScreenProps {
  shop: Shop;
  isRtl: boolean;
}

export function CustomerClosedScreen({ shop, isRtl }: CustomerClosedScreenProps) {
  const { t } = useTranslation();

  const daysNames = [
    t("sunday", "Sunday"),
    t("monday", "Monday"),
    t("tuesday", "Tuesday"),
    t("wednesday", "Wednesday"),
    t("thursday", "Thursday"),
    t("friday", "Friday"),
    t("saturday", "Saturday"),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-8 text-center shadow-lg"
    >
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4 text-indigo-600">
        <Clock className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        {t("shop_closed_title", "Shop is Currently Closed")}
      </h2>
      <p className="text-sm text-slate-500 leading-relaxed mb-6">
        {t("shop_closed_desc", "We are not currently accepting queue bookings. Please check our opening hours below.")}
      </p>

      {shop.workingHours && shop.workingHours.days && (
        <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
          <div className="flex items-center gap-2 p-3 bg-slate-100/50 border-b border-slate-100 px-4 text-slate-700 font-bold text-xs">
            <CalendarDays className="w-4 h-4 text-indigo-600" />
            <span>{t("working_hours", "Opening Hours")}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {Object.keys(shop.workingHours.days).map((dayKey) => {
              const dayConfig = shop.workingHours?.days?.[dayKey];
              if (!dayConfig) return null;
              
              const dayName = daysNames[parseInt(dayKey, 10)];
              const isToday = new Date().getDay() === parseInt(dayKey, 10);

              return (
                <div
                  key={dayKey}
                  className={`flex items-center justify-between p-3 px-4 text-xs ${
                    isToday ? "bg-indigo-50/50 text-indigo-900 font-bold" : "text-slate-600"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {dayName}
                    {isToday && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md font-bold">
                        {t("today", "Today")}
                      </span>
                    )}
                  </span>
                  {dayConfig.enabled ? (
                    <span className="font-mono">
                      {dayConfig.open} - {dayConfig.close}
                    </span>
                  ) : (
                    <span className="text-rose-500 font-bold">{t("closed", "Closed")}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
