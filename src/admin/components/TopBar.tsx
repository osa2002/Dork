/**
 * Enterprise Platform Administration - TopBar Header Component
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Menu,
  Search,
  Sun,
  Moon,
  Globe,
  Bell,
  LogOut,
  UserCheck,
  KeyRound,
  ShieldAlert,
  ChevronDown,
  X
} from "lucide-react";
import { useAdminStore } from "../store/adminStore";
import { Breadcrumb } from "./Breadcrumb";

interface ITopBarProps {
  onLogout: () => void;
}

export const TopBar: React.FC<ITopBarProps> = ({ onLogout }) => {
  const { t, i18n } = useTranslation();
  const user = useAdminStore((state) => state.user);
  const isDarkMode = useAdminStore((state) => state.isDarkMode);
  const setThemeMode = useAdminStore((state) => state.setThemeMode);
  const dir = useAdminStore((state) => state.dir);
  const setDirection = useAdminStore((state) => state.setDirection);
  const setMobileDrawerOpen = useAdminStore((state) => state.setMobileDrawerOpen);
  const activePath = useAdminStore((state) => state.activePath);
  const searchQuery = useAdminStore((state) => state.searchQuery);
  const setSearchQuery = useAdminStore((state) => state.setSearchQuery);
  const setMfaPromptOpen = useAdminStore((state) => state.setMfaPromptOpen);

  const alerts = useAdminStore((state) => state.alerts);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const unreadAlerts = alerts.filter((a) => a.status === "ACTIVE");
  const currentLang = (i18n.language || "ar").startsWith("ar") ? "ar" : "en";

  const handleToggleLanguage = () => {
    const nextLang = currentLang === "ar" ? "en" : "ar";
    const nextDir = nextLang === "ar" ? "rtl" : "ltr";
    i18n.changeLanguage(nextLang);
    setDirection(nextDir);
  };

  return (
    <header className="bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-30 backdrop-blur-md px-4 py-3 text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left Section: Mobile Menu & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Breadcrumb currentPath={activePath} />
        </div>

        {/* Center Section: Search Bar */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4 relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 rtl:right-3 rtl:left-auto" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("admin_search_placeholder", "Search tenants, audit logs, IP addresses, secrets...")}
            className="w-full pl-9 pr-8 rtl:pr-9 rtl:pl-8 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 rtl:left-2.5 rtl:right-auto text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right Section: Toggles, Notifications, Admin Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* RTL / LTR Language Direction Toggle */}
          <button
            onClick={handleToggleLanguage}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700/50"
            title={currentLang === "ar" ? "Switch to English" : "التحويل إلى العربية"}
          >
            <Globe className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
            <span className="text-xs font-bold">{currentLang === "ar" ? "English" : "العربية"}</span>
          </button>

          {/* Theme Mode Toggle */}
          <button
            onClick={() => setThemeMode(!isDarkMode)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700/50"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>

          {/* Notification Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setProfileOpen(false);
              }}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors relative cursor-pointer border border-slate-200 dark:border-slate-700/50"
            >
              <Bell className="w-4 h-4" />
              {unreadAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {unreadAlerts.length}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 rtl:left-0 rtl:right-auto mt-2 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-50 text-slate-900 dark:text-slate-100 animate-fadeIn">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200">Security Alerts</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-mono">
                    {unreadAlerts.length} Active
                  </span>
                </div>
                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                  {unreadAlerts.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No active security alerts.</p>
                  ) : (
                    unreadAlerts.map((alert) => (
                      <div
                        key={alert.alertId}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-xs flex items-start gap-2.5"
                      >
                        <ShieldAlert className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">{alert.ruleName}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{alert.service} &bull; {alert.metricValue}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setProfileOpen(!profileOpen);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700/60 cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow">
                {user?.displayName ? user.displayName.charAt(0) : "A"}
              </div>
              <div className="hidden sm:flex flex-col text-left rtl:text-right">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-none">{user?.displayName || "Admin User"}</span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">{user?.role}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 rtl:left-0 rtl:right-auto mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-3 z-50 text-slate-900 dark:text-slate-100 animate-fadeIn space-y-2">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
                  <div className="font-bold text-xs text-slate-900 dark:text-slate-100">{user?.displayName}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">{user?.email}</div>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Role: {user?.role}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setMfaPromptOpen(true);
                    setProfileOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-amber-600 dark:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span>Step-Up Authentication</span>
                </button>

                <div className="border-t border-slate-200 dark:border-slate-800 pt-2">
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out Admin Session</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
