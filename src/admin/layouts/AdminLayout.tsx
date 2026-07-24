/**
 * Enterprise Platform Administration - Master Layout Component
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { useEffect } from "react";
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
  const isDarkMode = useAdminStore((state) => state.isDarkMode);
  const dir = useAdminStore((state) => state.dir);

  // Sync dir attribute to document element for native RTL/LTR styling
  useEffect(() => {
    document.documentElement.dir = dir;
  }, [dir]);

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
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
