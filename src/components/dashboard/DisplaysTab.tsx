import React from "react";
import { Monitor, Plus, Loader2, Edit2, Check, RefreshCw, Trash2, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Display } from "../../types";

interface DisplaysTabProps {
  displays: Display[];
  editingDisplayId: string | null;
  setEditingDisplayId: (val: string | null) => void;
  editingDisplayName: string;
  setEditingDisplayName: (val: string) => void;
  refreshingDisplayId: string | null;
  handleUpdateDisplayName: (displayId: string) => void;
  handleDeleteDisplay: (displayId: string) => void;
  handleRequestRefresh: (displayId: string) => void;
  shopSlug: string | undefined;
}

export function DisplaysTab({
  displays,
  editingDisplayId,
  setEditingDisplayId,
  editingDisplayName,
  setEditingDisplayName,
  refreshingDisplayId,
  handleUpdateDisplayName,
  handleDeleteDisplay,
  handleRequestRefresh,
  shopSlug
}: DisplaysTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 animate-fade-in animate-duration-200" id="displays-tab">
      {/* Header info */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm space-y-2">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
          <Monitor className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">
          {t("vend_displays_title", "Manage Public Display Screens")}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
          {t("vend_displays_desc", "Configure and control smart screens displayed in your waiting lobby. You can rename screens, trigger instant display refreshes, or open public display screens directly.")}
        </p>
      </div>

      {/* Displays list */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h4 className="text-sm font-black text-slate-900 dark:text-white">
            {t("vend_registered_screens_title", "Registered Lobby Display Screens")}
          </h4>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-black border border-slate-200 dark:border-slate-700">
            {displays.length}
          </span>
        </div>

        {displays.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displays.map((display) => {
              const isEditing = editingDisplayId === display.id;
              const isRefreshing = refreshingDisplayId === display.id;
              const displayUrl = `${window.location.origin}/display/${display.id}`;

              return (
                <div 
                  key={display.id}
                  className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 p-5 rounded-2xl hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input 
                            type="text"
                            value={editingDisplayName}
                            onChange={(e) => setEditingDisplayName(e.target.value)}
                            className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-black focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1"
                            placeholder={t("vend_display_rename_placeholder", "Screen Name")}
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateDisplayName(display.id)}
                            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <h5 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white truncate">
                            {display.name}
                          </h5>
                          <button
                            onClick={() => {
                              setEditingDisplayId(display.id);
                              setEditingDisplayName(display.name);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleRequestRefresh(display.id)}
                          disabled={isRefreshing}
                          className="p-1.5 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer transition-all"
                          title={t("vend_refresh_display_tooltip", "Request Instant Reload")}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        </button>
                        <button
                          onClick={() => handleDeleteDisplay(display.id)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border border-transparent rounded-lg cursor-pointer transition-all"
                          title={t("btn_delete", "Delete")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 font-bold px-2 py-0.5 rounded-md">
                        ID: {display.id}
                      </span>
                      <p className="text-[10px] text-slate-400">
                        {t("vend_display_last_active_label", "Last active pulse:")} <strong className="font-semibold text-slate-500">{display.lastActive ? new Date(display.lastActive).toLocaleString() : t("never_label", "Never")}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-200/30 dark:border-slate-800 pt-3 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">
                      {t("vend_display_lobby_desc", "Display URL:")}
                    </span>
                    <a 
                      href={displayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      <span>{t("vend_open_display_btn", "Open Screen")}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-850">
            <Monitor className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3 animate-pulse" />
            <p className="text-xs font-black text-slate-700 dark:text-slate-300">
              {t("vend_no_display_screens_found", "No lobby display screens found")}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-sm mt-1 leading-normal">
              {t("vend_display_screens_instructions", "To launch a public TV display, open a new browser tab and navigate to /display-setup/{{slug}} and follow steps. Connected screens will instantly show up here!").replace("{{slug}}", shopSlug || "")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
