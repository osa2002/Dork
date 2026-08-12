/**
 * Enterprise Platform Administration - Master Layout Component
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAdminStore } from "../store/adminStore";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { SecurityBanner } from "../components/SecurityBanner";
import { MfaModal } from "../components/MfaModal";
import { AdminErrorBoundary } from "../components/AdminErrorBoundary";

interface IAdminLayoutProps {
  children: React.ReactNode;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export const AdminLayout: React.FC<IAdminLayoutProps> = ({ children, onNavigate, onLogout }) => {
  const { i18n } = useTranslation();
  const isDarkMode = useAdminStore((state) => state.isDarkMode);
  const dir = useAdminStore((state) => state.dir);
  const setDirection = useAdminStore((state) => state.setDirection);

  // Sync dark mode class on document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Sync dir attribute to document element and store for native RTL/LTR styling
  useEffect(() => {
    const calculatedDir = (i18n.language || "ar").startsWith("ar") ? "rtl" : "ltr";
    if (calculatedDir !== dir) {
      setDirection(calculatedDir);
    }
    document.documentElement.dir = calculatedDir;
    document.body.dir = calculatedDir;
  }, [i18n.language]);

  useEffect(() => {
    document.documentElement.dir = dir;
    document.body.dir = dir;
  }, [dir]);

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 ${isDarkMode ? "dark" : ""}`}>
      <AdminErrorBoundary>
        <SecurityBanner />
        
        <div className="flex min-h-[calc(100vh-33px)]">
          <Sidebar onNavigate={onNavigate} />

          <div className="flex-1 flex flex-col min-w-0">
            <TopBar onLogout={onLogout} />

            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
              {children}
            </main>
          </div>
        </div>

        <MfaModal />
      </AdminErrorBoundary>
    </div>
  );
};
