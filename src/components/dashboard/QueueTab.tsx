import React from "react";
import { 
  Filter, Activity, Users, CheckCircle2, Clock, 
  Volume2, Trash2, CalendarRange, Star, RefreshCcw, BellRing
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Ticket, Service } from "../../types";

interface QueueTabProps {
  tickets: Ticket[];
  services: Service[];
  activeCounterNumber: string;
  setActiveCounterNumber: (val: string) => void;
  counterStatus: "online" | "busy" | "break" | "offline";
  updateCounterStatus: (val: "online" | "busy" | "break" | "offline") => void;
  selectedQueueServiceId: string;
  setSelectedQueueServiceId: (val: string) => void;
  handleCallNext: (selectedQueueServiceId: string) => void;
  handleCallTicket: (ticket: Ticket) => void;
  handleUpdateTicketStatus: (ticketId: string, status: "completed" | "cancelled" | "no_show" | "waiting") => void;
  handleTogglePriority: (ticketId: string, currentPriority: boolean) => void;
  isRtl: boolean;
}

export function QueueTab({
  tickets,
  services,
  activeCounterNumber,
  setActiveCounterNumber,
  counterStatus,
  updateCounterStatus,
  selectedQueueServiceId,
  setSelectedQueueServiceId,
  handleCallNext,
  handleCallTicket,
  handleUpdateTicketStatus,
  handleTogglePriority,
  isRtl
}: QueueTabProps) {
  const { t } = useTranslation();

  // Categorize tickets based on current filters
  const waitingTickets = React.useMemo(() => {
    return tickets.filter(tItem => tItem.status === "waiting");
  }, [tickets]);
  
  const filteredWaitingTickets = React.useMemo(() => {
    return tickets.filter(
      tItem => tItem.status === "waiting" && (selectedQueueServiceId === "all" || tItem.serviceId === selectedQueueServiceId)
    );
  }, [tickets, selectedQueueServiceId]);
  
  const filteredPastTickets = React.useMemo(() => {
    return tickets.filter(
      tItem => (tItem.status === "completed" || tItem.status === "cancelled" || tItem.status === "no_show") && 
               (selectedQueueServiceId === "all" || tItem.serviceId === selectedQueueServiceId)
    );
  }, [tickets, selectedQueueServiceId]);

  const filteredScheduledTickets = React.useMemo(() => {
    return tickets.filter(
      tItem => tItem.status === "scheduled" && (selectedQueueServiceId === "all" || tItem.serviceId === selectedQueueServiceId)
    );
  }, [tickets, selectedQueueServiceId]);

  const activeCallingTicket = React.useMemo(() => {
    return tickets.find(
      tItem => tItem.status === "calling" && (selectedQueueServiceId === "all" || tItem.serviceId === selectedQueueServiceId)
    );
  }, [tickets, selectedQueueServiceId]);

  // Calculate total expected wait time for the waiting queue
  const totalCurrentWaitTime = React.useMemo(() => {
    return waitingTickets.reduce((acc, ticket) => {
      const service = services.find(s => s.id === ticket.serviceId);
      return acc + (service?.avgDurationMinutes || 15);
    }, 0);
  }, [waitingTickets, services]);

  // Pre-calculate waiting and completed ticket counts to avoid inline filtering during render
  const waitingCount = waitingTickets.length;
  const completedCount = React.useMemo(() => {
    return tickets.filter(tItem => tItem.status === "completed").length;
  }, [tickets]);

  const serviceWaitingCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    services.forEach(service => {
      counts[service.id] = tickets.filter(tItem => tItem.status === "waiting" && tItem.serviceId === service.id).length;
    });
    return counts;
  }, [tickets, services]);

  return (
    <div className="space-y-6 animate-fade-in animate-duration-200" id="queue-board-tab">
      
      {/* Waiting Paths / Queues Segmented Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {t("vend_queue_filter", "Queue Filter")}
            </h3>
          </div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 self-start sm:self-auto border border-indigo-100 dark:border-indigo-900/30">
            {t("vend_current_path", "Current Path: ")}
            {selectedQueueServiceId === "all"
              ? t("vend_all_paths", "All Paths") 
              : (services.find(s => s.id === selectedQueueServiceId)?.name || "")}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedQueueServiceId("all")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-200 cursor-pointer ${
              selectedQueueServiceId === "all"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none border border-transparent"
                : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
            }`}
          >
            {t("vend_all_waiting_paths", "All Waiting Paths")} ({waitingCount})
          </button>
          
          {services.map((service) => {
            const serviceWaitingCount = serviceWaitingCounts[service.id] || 0;
            return (
              <button
                key={service.id}
                onClick={() => setSelectedQueueServiceId(service.id)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                  selectedQueueServiceId === service.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none border border-transparent"
                    : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
                }`}
              >
                <span>{service.name}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                  selectedQueueServiceId === service.id 
                    ? "bg-white/20 text-white" 
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}>
                  {serviceWaitingCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Real-time Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Tickets */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">
              {t("vend_total_tickets_today", "Total Tickets Today")}
            </span>
            <span className="block text-xl font-black text-slate-900 dark:text-white font-mono">
              {tickets.length}
            </span>
          </div>
        </div>

        {/* Card 2: Customers Waiting */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">
              {t("vend_currently_waiting_stat", "Currently Waiting")}
            </span>
            <span className="block text-xl font-black text-slate-900 dark:text-white font-mono">
              {waitingCount}
            </span>
          </div>
        </div>

        {/* Card 3: Served Customers */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">
              {t("vend_served_customers_stat", "Served Customers")}
            </span>
            <span className="block text-xl font-black text-slate-900 dark:text-white font-mono">
              {completedCount}
            </span>
          </div>
        </div>

        {/* Card 4: Expected Wait Time */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">
              {t("vend_expected_wait_time_stat", "Expected Wait Time")}
            </span>
            <span className="block text-xl font-black text-slate-900 dark:text-white font-mono">
              {totalCurrentWaitTime} {t("vend_mins_abbrev", "mins")}
            </span>
          </div>
        </div>
      </div>

      {/* Active Calling Controller Panel */}
      <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/50 dark:from-indigo-950/20 dark:to-indigo-950/40 border border-indigo-200/50 dark:border-indigo-900/30 p-6 rounded-3xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>{t("vend_smart_calling_controller", "Smart Calling & Controller")}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t("vend_smart_calling_controller_desc", "Call customers into service. Keyboard shortcuts: [Enter] calls next, [Delete] cancels current.")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Active Counter Input */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2 flex items-center gap-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider truncate shrink-0">
                {t("vend_counter_num_label", "Counter #")}
              </span>
              <input 
                type="text"
                value={activeCounterNumber}
                onChange={(e) => setActiveCounterNumber(e.target.value)}
                className="w-10 bg-transparent border-0 p-0 text-slate-800 dark:text-white text-sm font-black font-mono text-center focus:outline-none focus:ring-0"
              />
            </div>

            {/* Counter status selector dropdown */}
            <select
              value={counterStatus}
              onChange={(e) => updateCounterStatus(e.target.value as any)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-2xl text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="online">🟢 {t("vend_status_online", "Online")}</option>
              <option value="busy">🔴 {t("vend_status_busy_option", "Busy")}</option>
              <option value="break">☕ {t("vend_status_break_option", "Break")}</option>
              <option value="offline">⚪ {t("vend_status_offline", "Offline")}</option>
            </select>
          </div>
        </div>

        {/* Calling trigger buttons split row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          
          {/* Active Called Client Display Box */}
          <div className="md:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm text-center space-y-3 relative overflow-hidden h-40 flex flex-col justify-center">
            {activeCallingTicket ? (
              <div className="space-y-1.5 animate-fade-in">
                <span className="text-[10px] bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 font-extrabold px-2.5 py-1 rounded-md border border-rose-100 dark:border-rose-900/30">
                  {t("vend_now_serving_label", "Now Serving")}
                </span>
                <h4 className="text-4xl font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight">
                  #{activeCallingTicket.ticketNumber}
                </h4>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate px-2">
                  {activeCallingTicket.customerName}
                </p>
                <p className="text-[10px] text-slate-400">
                  {activeCallingTicket.serviceName}
                </p>
              </div>
            ) : (
              <div className="text-slate-400 dark:text-slate-500 text-xs py-4">
                <Users className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2 animate-bounce" />
                <p className="font-bold">{t("vend_no_active_called_ticket", "No active ticket is currently being called.")}</p>
                <p className="text-[10px] text-slate-400 mt-1">{t("vend_click_call_next_desc", "Click 'Call Next Customer' to pull the next ticket.")}</p>
              </div>
            )}
            <div className="absolute top-0 end-0 w-20 h-20 bg-indigo-50/20 dark:bg-indigo-900/5 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Action triggers: complete, cancel, next */}
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => handleCallNext(selectedQueueServiceId)}
              className="sm:col-span-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black text-sm py-8 px-6 rounded-3xl shadow-lg shadow-indigo-200/80 dark:shadow-none transition-all hover:scale-[1.01] cursor-pointer flex flex-col items-center justify-center gap-2 h-40 group"
              id="btn-call-next"
            >
              <BellRing className="w-6 h-6 text-white group-hover:animate-swing" />
              <span className="text-sm font-black">{t("vend_call_next_customer", "Call Next Customer")}</span>
              <span className="text-[10px] text-indigo-100 font-medium">
                {t("vend_keyboard_shortcut_hint_call", "Keyboard shortcut: [Enter]")}
              </span>
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-1 gap-3 h-40">
              <button
                onClick={() => {
                  if (activeCallingTicket) {
                    handleUpdateTicketStatus(activeCallingTicket.id, "completed");
                  } else {
                    alert(t("vend_no_active_called_ticket", "No active ticket is currently being called."));
                  }
                }}
                disabled={!activeCallingTicket}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold text-xs rounded-2xl transition-all cursor-pointer shadow-sm shadow-emerald-100 dark:shadow-none flex flex-col items-center justify-center gap-1.5 py-4"
                id="btn-complete-current"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{t("vend_complete_turn", "Complete Turn")}</span>
              </button>

              <button
                onClick={() => {
                  if (activeCallingTicket) {
                    handleUpdateTicketStatus(activeCallingTicket.id, "cancelled");
                  } else {
                    alert(t("vend_no_active_called_ticket", "No active ticket is currently being called."));
                  }
                }}
                disabled={!activeCallingTicket}
                className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 border border-rose-100 dark:border-rose-900/30 disabled:opacity-40 font-extrabold text-xs rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 py-4"
                id="btn-cancel-current"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t("vend_cancel_current_turn", "Cancel / No Show")}</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Grid: Waiting active lists + Histories past lists */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Waiting customers list (Left Column) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                {t("vend_waiting_customers_header", "Waiting Customers")}
              </h4>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-black border border-slate-200 dark:border-slate-700">
              {filteredWaitingTickets.length}
            </span>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pe-1">
            {filteredWaitingTickets.length > 0 ? (
              filteredWaitingTickets.map((tItem) => (
                <div 
                  key={tItem.id}
                  className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 p-3.5 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono">#{tItem.ticketNumber}</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-xs font-black text-slate-800 dark:text-white truncate">{tItem.customerName}</span>
                      {tItem.isPriority && (
                        <span className="px-1.5 py-0.5 bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-[8px] font-black rounded-md flex items-center gap-0.5">
                          <Star className="w-2 h-2 fill-rose-500" />
                          <span>VIP</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium truncate">
                      {tItem.serviceName}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCallTicket(tItem)}
                      className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-400 font-black text-[10px] py-1.5 px-3 rounded-lg transition-all cursor-pointer"
                    >
                      {t("vend_call_btn_label", "Call")}
                    </button>
                    <button
                      onClick={() => handleTogglePriority(tItem.id, tItem.isPriority || false)}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        tItem.isPriority 
                          ? "bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/30 dark:border-rose-900/40" 
                          : "bg-white border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700 hover:text-slate-600"
                      }`}
                      title="Toggle VIP"
                    >
                      <Star className={`w-3.5 h-3.5 ${tItem.isPriority ? "fill-rose-500 text-rose-600" : ""}`} />
                    </button>
                    <button
                      onClick={() => handleUpdateTicketStatus(tItem.id, "cancelled")}
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border border-transparent transition-all cursor-pointer"
                      title="Cancel"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                {t("vend_no_waiting_customers", "No waiting customers.")}
              </div>
            )}
          </div>
        </div>

        {/* Past tickets list (Right Column) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                {t("vend_completed_history_today", "Completed & History Today")}
              </h4>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-black border border-slate-200 dark:border-slate-700">
              {filteredPastTickets.length}
            </span>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pe-1">
            {filteredPastTickets.length > 0 ? (
              filteredPastTickets.map((tItem) => {
                let badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30";
                let badgeLabel = t("ticket_status_completed", "Completed");
                if (tItem.status === "cancelled") {
                  badgeBg = "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30";
                  badgeLabel = t("ticket_status_cancelled", "Cancelled");
                } else if (tItem.status === "no_show") {
                  badgeBg = "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30";
                  badgeLabel = t("ticket_status_noshow", "No Show");
                }

                return (
                  <div 
                    key={tItem.id}
                    className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 p-3.5 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-400 font-mono">#{tItem.ticketNumber}</span>
                        <span className="text-xs font-black text-slate-800 dark:text-white truncate">{tItem.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-medium truncate">
                          {tItem.serviceName}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black border uppercase ${badgeBg}`}>
                          {badgeLabel}
                        </span>
                        {tItem.rating && (
                          <span className="text-amber-500 font-black text-[10px] flex items-center gap-0.5">
                            ★ {tItem.rating}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        onClick={() => handleUpdateTicketStatus(tItem.id, "waiting")}
                        className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold text-[9px] py-1 px-2.5 rounded-lg transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                      >
                        {t("vend_re_queue_btn", "Re-queue")}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                {t("vend_no_historical_tickets_today", "No historical tickets today.")}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Future Scheduled Bookings & Appointments Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="space-y-1">
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-indigo-600" />
              <span>{t("vend_scheduled_appointments_title", "Scheduled Appointments & Future Bookings")}</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("vend_scheduled_appointments_desc", "Clients who booked in advance. Click 'Check In' to instantly move them to the active waiting queue upon arrival.")}
            </p>
          </div>

          <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-xs font-black border border-indigo-100 dark:border-indigo-900/30 self-start sm:self-auto">
            {filteredScheduledTickets.length} {t("vend_scheduled_status_count", "Scheduled")}
          </span>
        </div>

        {filteredScheduledTickets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredScheduledTickets.map((tItem) => (
              <div key={tItem.id} className="bg-slate-50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-850 p-4 rounded-2xl flex flex-col justify-between gap-3.5 hover:border-indigo-100 dark:hover:border-indigo-900/40 hover:shadow-sm transition-all duration-200">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-extrabold px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                      {tItem.serviceName}
                    </span>
                    <span className="text-[10px] bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-md font-mono font-black">
                      #{tItem.ticketNumber}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h5 className="text-xs font-black text-slate-800 dark:text-white">{tItem.customerName}</h5>
                    {(tItem.customerPhone || tItem.customerEmail) && (
                      <p className="text-[10px] text-slate-400 font-medium">
                        {tItem.customerPhone && <span>📱 {tItem.customerPhone} </span>}
                        {tItem.customerEmail && <span className="block mt-0.5">✉️ {tItem.customerEmail}</span>}
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-200/40 dark:border-slate-800/40 pt-3 flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-400 font-bold">{t("vend_scheduled_slot_label", "Scheduled slot:")}</span>
                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-black">
                      {tItem.scheduledDate} @ {tItem.scheduledTime}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateTicketStatus(tItem.id, "waiting")}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] py-1.5 px-3 rounded-xl shadow-md shadow-indigo-100 dark:shadow-none cursor-pointer transition-all hover:scale-[1.02]"
                    >
                      {t("vend_check_in_btn", "Check In ✅")}
                    </button>
                    <button
                      onClick={() => handleUpdateTicketStatus(tItem.id, "cancelled")}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-rose-500 font-extrabold text-[10px] py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                      title={t("vend_cancel_slot_title", "Cancel Slot")}
                    >
                      {t("vend_cancel_btn", "Cancel")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/80">
            <CalendarRange className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2.5 animate-pulse" />
            <p className="text-xs font-black text-slate-700 dark:text-slate-300">
              {t("vend_no_scheduled_appointments_found", "No scheduled appointments found")}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mt-1">
              {t("vend_no_scheduled_appointments_desc", "Any client scheduling a future booking slot through the portal will appear here. Upon their arrival, click 'Check In' to instantly move them into live queues.")}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
