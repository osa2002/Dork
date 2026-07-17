import React from "react";
import { useTranslation } from "react-i18next";
import { Users, Smartphone, Sun, Moon } from "lucide-react";
import { Shop } from "../../types";
import LanguageSwitcher from "../LanguageSwitcher";

interface CustomerHeaderProps {
  shop: Shop | null;
  translateCategory: (cat: string) => string;
  isStandalone: boolean;
  deferredPrompt: any;
  handleInstallPWA: () => void;
  setShowPwaModal: (val: boolean) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  onBackToHome: () => void;
  isRtl: boolean;
}

export function CustomerHeader({
  shop,
  translateCategory,
  isStandalone,
  deferredPrompt,
  handleInstallPWA,
  setShowPwaModal,
  isDarkMode,
  setIsDarkMode,
  onBackToHome,
  isRtl
}: CustomerHeaderProps) {
  const { t } = useTranslation();

  if (!shop) return null;

  return (
    <div className="w-full max-w-md flex items-center justify-between mb-6 z-10">
      <div className="flex items-center gap-3">
        {shop.logoUrl ? (
          <img 
            src={shop.logoUrl} 
            alt={shop.name} 
            className="w-10 h-10 rounded-xl object-cover border border-slate-200/80 bg-white shadow-sm"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow shadow-indigo-100">
            <Users className="w-5 h-5" />
          </div>
        )}
        <div className="text-start">
          <h1 className="text-base font-black text-slate-900 leading-none">{shop.name}</h1>
          <span className="text-[10px] text-indigo-600 font-bold mt-0.5 block">
            {translateCategory(shop.category)}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <LanguageSwitcher />

        {/* Add to Home Screen PWA Button */}
        {!isStandalone && (
          <button
            onClick={() => {
              if (deferredPrompt) {
                handleInstallPWA();
              } else {
                setShowPwaModal(true);
              }
            }}
            className={`p-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
              isDarkMode
                ? "bg-emerald-950/40 border-emerald-900/50 text-emerald-400 hover:bg-emerald-900/60"
                : "bg-emerald-50 border-emerald-100 text-emerald-800 hover:bg-emerald-100 hover:scale-[1.03] active:scale-97 shadow-sm"
            }`}
            title={isRtl ? "إضافة للشاشة الرئيسية" : "Add to Home Screen"}
          >
            <Smartphone className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black hidden xs:inline">
              {isRtl ? "تثبيت" : "Install"}
            </span>
          </button>
        )}

        {/* Dark Mode Toggle Button */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
            isDarkMode 
              ? "bg-slate-800 text-amber-400 hover:bg-slate-700" 
              : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200/80 shadow-sm"
          }`}
          title={isDarkMode ? (isRtl ? "تفعيل الوضع المضيء" : "Enable Light Mode") : (isRtl ? "تفعيل الوضع الداكن" : "Enable Dark Mode")}
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        <button
          onClick={onBackToHome}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
        >
          {t("home")}
        </button>
      </div>
    </div>
  );
}
