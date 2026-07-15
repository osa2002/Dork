import React from "react";
import { Clock, Plus, Loader2, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Service } from "../../types";

interface ServicesTabProps {
  services: Service[];
  newServiceName: string;
  setNewServiceName: (val: string) => void;
  newServiceDuration: number;
  setNewServiceDuration: (val: number) => void;
  serviceActionLoading: boolean;
  handleAddService: (e: React.FormEvent) => void;
  handleToggleService: (serviceId: string, currentStatus: boolean) => void;
  handleDeleteService: (serviceId: string) => void;
}

export function ServicesTab({
  services,
  newServiceName,
  setNewServiceName,
  newServiceDuration,
  setNewServiceDuration,
  serviceActionLoading,
  handleAddService,
  handleToggleService,
  handleDeleteService
}: ServicesTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 animate-fade-in animate-duration-200" id="services-tab">
      {/* Header info */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm space-y-2">
        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">
          {t("vend_services_manage_title", "Manage Waiting Paths & Services")}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
          {t("vend_services_manage_desc", "Define different customer journeys and specific wait path services in-store to lower wait bottlenecks and isolate analytics.")}
        </p>
      </div>

      {/* Split layout: add service and service list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left panel: Add service */}
        <form onSubmit={handleAddService} className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
          <h4 className="text-sm font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>{t("vend_add_service_section_title", "Add New Service")}</span>
          </h4>

          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
              {t("vend_field_service_name_label", "Service Name / Department")}
            </label>
            <input 
              type="text"
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              placeholder={t("vend_field_service_name_example", "e.g., Sales, Maintenance, Reception")}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
              {t("vend_field_service_duration", "Avg Service Duration (Minutes)")}
            </label>
            <input 
              type="number"
              min="1"
              max="180"
              value={newServiceDuration}
              onChange={(e) => setNewServiceDuration(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={serviceActionLoading || !newServiceName.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs py-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow shadow-indigo-100 dark:shadow-none"
            id="btn-create-service"
          >
            {serviceActionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>{t("vend_btn_create_service", "Create Wait Path")}</span>
              </>
            )}
          </button>
        </form>

        {/* Right panel: services list */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
          <h4 className="text-sm font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
            {t("vend_active_services_title", "Active Waiting Path Services")}
          </h4>

          <div className="space-y-3">
            {services.length > 0 ? (
              services.map((service) => (
                <div 
                  key={service.id}
                  className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 p-4 rounded-2xl hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <h5 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white">
                      {service.name}
                    </h5>
                    <p className="text-[10px] text-slate-400 font-medium">
                      ⏱️ {t("vend_est_wait_label", "Estimated wait:")} <strong className="text-slate-600 dark:text-slate-300 font-bold">{service.avgDurationMinutes} {t("vend_mins_abbrev", "mins")}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleService(service.id, service.isActive)}
                      className={`text-xs font-black py-1.5 px-3 rounded-lg cursor-pointer transition-all flex items-center gap-1 ${
                        service.isActive 
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" 
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                      title={service.isActive ? t("vend_service_active_tooltip", "Service is Active") : t("vend_service_inactive_tooltip", "Service is Paused")}
                    >
                      {service.isActive ? (
                        <>
                          <ToggleRight className="w-4 h-4" />
                          <span>{t("service_status_active", "Active")}</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4" />
                          <span>{t("service_status_inactive", "Paused")}</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteService(service.id)}
                      className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border border-transparent transition-all cursor-pointer"
                      title={t("btn_delete", "Delete")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                {t("vend_no_services_found", "No waiting path services defined yet. Create your first service on the left panel.")}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
