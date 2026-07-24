import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { 
  WebhookConfig, WebhookLog, WebhookEvent 
} from "../../types";
import { 
  Radio, Plus, Trash2, Edit3, Copy, Check, Play, RefreshCw, 
  ShieldCheck, Key, Globe, FileText, AlertCircle, ExternalLink, 
  Clock, CheckCircle2, XCircle, ArrowUpRight, Zap, Code, Terminal, Eye, Layers
} from "lucide-react";

interface WebhooksTabProps {
  webhooks: WebhookConfig[];
  logs: WebhookLog[];
  loading: boolean;
  actionLoading: boolean;

  // Modal
  isModalOpen: boolean;
  openModal: (webhook?: WebhookConfig) => void;
  closeModal: () => void;
  editingWebhook: WebhookConfig | null;
  formName: string;
  setFormName: (val: string) => void;
  formUrl: string;
  setFormUrl: (val: string) => void;
  formSecret: string;
  setFormSecret: (val: string) => void;
  formEvents: WebhookEvent[];
  toggleEventSelection: (event: WebhookEvent) => void;
  formHeaders: { key: string; value: string }[];
  handleAddHeader: () => void;
  handleUpdateHeader: (index: number, field: "key" | "value", value: string) => void;
  handleRemoveHeader: (index: number) => void;
  formError: string | null;
  handleSaveWebhook: (e: React.FormEvent) => void;

  // Actions
  handleToggleActive: (webhook: WebhookConfig) => void;
  handleDeleteWebhook: (webhook: WebhookConfig) => void;

  // Test
  testingWebhook: WebhookConfig | null;
  openTestModal: (webhook: WebhookConfig) => void;
  closeTestModal: () => void;
  testEvent: WebhookEvent;
  setTestEvent: (event: WebhookEvent) => void;
  isTesting: boolean;
  testResult: any | null;
  handleRunTest: () => void;

  // Inspector
  inspectingLog: WebhookLog | null;
  setInspectingLog: (log: WebhookLog | null) => void;
  handleResendLog: (log: WebhookLog) => void;

  isRtl?: boolean;
}

const ALL_EVENTS: { id: WebhookEvent; labelEn: string; labelAr: string; descriptionEn: string }[] = [
  { id: "ticket.created", labelEn: "New Ticket Issued", labelAr: "تذكرة جديدة", descriptionEn: "Triggered when a customer joins the queue or reserves a slot." },
  { id: "ticket.calling", labelEn: "Customer Called", labelAr: "استدعاء العميل", descriptionEn: "Triggered when a staff desk calls a ticket to a counter." },
  { id: "ticket.completed", labelEn: "Ticket Completed", labelAr: "اكتمال التذكرة", descriptionEn: "Triggered when customer service concludes." },
  { id: "ticket.cancelled", labelEn: "Ticket Cancelled", labelAr: "إلغاء التذكرة", descriptionEn: "Triggered when a ticket is cancelled by customer or staff." },
  { id: "ticket.no_show", labelEn: "Customer No-Show", labelAr: "عدم حضور العميل", descriptionEn: "Triggered when customer is marked absent after call." },
  { id: "queue.paused", labelEn: "Queue Paused", labelAr: "إيقاف الطابور", descriptionEn: "Triggered when queue intake is temporarily paused." },
  { id: "queue.resumed", labelEn: "Queue Resumed", labelAr: "استئناف الطابور", descriptionEn: "Triggered when queue intake is re-opened." },
];

export function WebhooksTab({
  webhooks,
  logs,
  loading,
  actionLoading,
  isModalOpen,
  openModal,
  closeModal,
  editingWebhook,
  formName,
  setFormName,
  formUrl,
  setFormUrl,
  formSecret,
  setFormSecret,
  formEvents,
  toggleEventSelection,
  formHeaders,
  handleAddHeader,
  handleUpdateHeader,
  handleRemoveHeader,
  formError,
  handleSaveWebhook,
  handleToggleActive,
  handleDeleteWebhook,
  testingWebhook,
  openTestModal,
  closeTestModal,
  testEvent,
  setTestEvent,
  isTesting,
  testResult,
  handleRunTest,
  inspectingLog,
  setInspectingLog,
  handleResendLog,
  isRtl = false,
}: WebhooksTabProps) {
  const { t, i18n } = useTranslation();
  const activeIsRtl = isRtl || (i18n.language || "ar").startsWith("ar");
  const [copiedPayloadEvent, setCopiedPayloadEvent] = useState<string | null>(null);
  const [activeGuideTab, setActiveGuideTab] = useState<"zapier" | "make" | "hubspot" | "custom">("zapier");

  const totalLogsCount = logs.length;
  const successfulLogsCount = logs.filter((l) => l.success).length;
  const successRate = totalLogsCount > 0 ? Math.round((successfulLogsCount / totalLogsCount) * 100) : 100;

  const copyToClipboard = (text: string, eventId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPayloadEvent(eventId);
    setTimeout(() => setCopiedPayloadEvent(null), 2000);
  };

  const getSamplePayloadForEvent = (event: WebhookEvent) => {
    return JSON.stringify(
      {
        event,
        timestamp: new Date().toISOString(),
        shopId: "shop_12345",
        shopName: "Central Operations Desk",
        ticket: {
          id: "tkt_88203",
          ticketNumber: 104,
          customerName: "Alex Rivera",
          customerPhone: "+1 (555) 234-5678",
          customerEmail: "alex@example.com",
          serviceName: "VIP Concierge",
          status: event === "ticket.created" ? "waiting" : event === "ticket.calling" ? "calling" : event === "ticket.completed" ? "completed" : "cancelled",
          counterNumber: "Desk 3",
          createdAt: new Date().toISOString(),
          calledAt: event !== "ticket.created" ? new Date().toISOString() : undefined,
        },
      },
      null,
      2
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-800/40">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-black tracking-wide uppercase">
              <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>{t("webhook_badge", activeIsRtl ? "الأتمتة المباشرة ومزامنة الـ CRM" : "Real-Time Automation & CRM Sync")}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {t("webhook_title", activeIsRtl ? "إعدادات الربط عبر Webhooks" : "Webhook Outbound Configurations")}
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              {t(
                "webhook_desc",
                activeIsRtl 
                  ? "إرسال أحداث الطابور اللحظية (تذكرة جديدة، استدعاء عميل، اكتمال الخدمة) تلقائياً إلى أنظمتك الخارجية مثل Zapier أو Make.com أو HubSpot أو Slack أو خوادم CRM الخاصة بك."
                  : "Automatically dispatch real-time queue state events (new ticket, customer called, ticket completed) to external systems like Zapier, Make.com, HubSpot, Slack, or custom CRM APIs."
              )}
            </p>
          </div>

          <button
            onClick={() => openModal()}
            className="shrink-0 inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs sm:text-sm font-extrabold px-5 py-3 rounded-2xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t("webhook_add_btn", activeIsRtl ? "إضافة نقطة نهاية Webhook" : "Add Webhook Endpoint")}</span>
          </button>
        </div>

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-indigo-800/50">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <span className="text-xs text-indigo-200 font-medium block mb-1">
              {t("webhook_stat_active", activeIsRtl ? "نقاط النهاية النشطة" : "Active Endpoints")}
            </span>
            <div className="text-2xl font-black text-white flex items-center gap-2">
              <span>{webhooks.filter((w) => w.isActive).length}</span>
              <span className="text-xs font-bold text-slate-400">/ {webhooks.length}</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <span className="text-xs text-indigo-200 font-medium block mb-1">
              {t("webhook_stat_events", activeIsRtl ? "الأحداث المدعومة" : "Supported Triggers")}
            </span>
            <div className="text-2xl font-black text-amber-400">{activeIsRtl ? "7 أحداث" : "7 Events"}</div>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <span className="text-xs text-indigo-200 font-medium block mb-1">
              {t("webhook_stat_dispatches", activeIsRtl ? "السجلات الحديثة" : "Recent Deliveries")}
            </span>
            <div className="text-2xl font-black text-white">{totalLogsCount}</div>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <span className="text-xs text-indigo-200 font-medium block mb-1">
              {t("webhook_stat_success_rate", activeIsRtl ? "نسبة نجاح الإرسال" : "Delivery Success")}
            </span>
            <div className="text-2xl font-black text-emerald-400">{successRate}%</div>
          </div>
        </div>
      </div>

      {/* Webhook Endpoints List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Radio className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>{t("webhook_endpoints_header", activeIsRtl ? "نقاط النهاية المحددة" : "Configured Endpoints")}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {t("webhook_endpoints_subheader", activeIsRtl ? "إدارة عناوين الـ URL النشطة التي تستقبل تحديثات حالة الطابور مباشرة." : "Manage active URLs receiving live queue status updates.")}
            </p>
          </div>
          <span className="text-xs font-black px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {webhooks.length} {activeIsRtl ? "نقطة نهاية" : webhooks.length === 1 ? "Endpoint" : "Endpoints"}
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="text-xs font-bold">{t("loading_webhooks", activeIsRtl ? "جاري مزامنة نقاط النهاية..." : "Syncing webhook endpoints...")}</span>
          </div>
        ) : webhooks.length === 0 ? (
          <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 flex flex-col items-center justify-center">
            <Globe className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
            <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mb-1">
              {t("no_webhooks_title", activeIsRtl ? "لا توجد نقاط نهاية Webhook معرفة" : "No Webhook Endpoints Configured")}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
              {t(
                "no_webhooks_desc",
                activeIsRtl
                  ? "قم بربط لوحة التحكم بـ Zapier أو Make أو خوادم CRM المخصصة لإرسال تنبيهات تلقائية ومزامنة المبيعات عند استدعاء التذاكر."
                  : "Connect your queue dashboard to Zapier, Make, or custom CRM servers to send automated SMS alerts, sync sales leads, or notify team channels when tickets are called."
              )}
            </p>
            <button
              onClick={() => openModal()}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t("create_first_webhook", activeIsRtl ? "إضافة أول نقطة نهاية" : "Configure First Webhook")}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className={`p-5 rounded-2xl border transition-all duration-200 ${
                  wh.isActive
                    ? "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800/80 shadow-sm"
                    : "bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-75"
                }`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                        {wh.name}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          wh.isActive
                            ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50"
                            : "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50"
                        }`}
                      >
                        {wh.isActive ? t("active", activeIsRtl ? "نشط" : "Active") : t("paused", activeIsRtl ? "مُتوقف" : "Paused")}
                      </span>

                      {wh.secret ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          <ShieldCheck className="w-3 h-3 text-indigo-500" />
                          <span>HMAC Signed</span>
                        </span>
                      ) : null}

                      {wh.headers && wh.headers.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          <Code className="w-3 h-3 text-cyan-500" />
                          <span>{wh.headers.length} {activeIsRtl ? "ترويسة مخصصة" : wh.headers.length === 1 ? "Custom Header" : "Custom Headers"}</span>
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl break-all dir-ltr text-left" dir="ltr">
                      <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate">{wh.url}</span>
                    </div>

                    {/* Triggers List */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider me-1">
                        {activeIsRtl ? "المحفزات:" : "Triggers:"}
                      </span>
                      {wh.events.map((evt) => (
                        <span
                          key={evt}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40 font-mono dir-ltr"
                          dir="ltr"
                        >
                          {evt}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => openTestModal(wh)}
                      className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 dark:bg-slate-800 dark:hover:bg-indigo-950/50 dark:text-slate-300 dark:hover:text-indigo-300 px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                      title={t("test_endpoint", activeIsRtl ? "اختبار إرسال الحمولة" : "Test Payload Dispatch")}
                    >
                      <Play className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500" />
                      <span>{t("test", activeIsRtl ? "اختبار" : "Test")}</span>
                    </button>

                    <button
                      onClick={() => openModal(wh)}
                      className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all cursor-pointer"
                      title={t("edit", activeIsRtl ? "تعديل إعدادات نقطة النهاية" : "Edit Endpoint Configuration")}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleToggleActive(wh)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        wh.isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                      title={wh.isActive ? t("pause_webhook", activeIsRtl ? "إيقاف الـ Webhook" : "Pause Webhook") : t("activate_webhook", activeIsRtl ? "تفعيل الـ Webhook" : "Activate Webhook")}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          wh.isActive ? (activeIsRtl ? "-translate-x-5" : "translate-x-5") : "translate-x-0"
                        }`}
                      />
                    </button>

                    <button
                      onClick={() => handleDeleteWebhook(wh)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                      title={t("delete", activeIsRtl ? "حذف نقطة النهاية" : "Delete Endpoint")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Webhook Delivery Logs History */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>{t("webhook_logs_header", activeIsRtl ? "سجل عمليات الإرسال الحديثة" : "Recent Delivery Logs")}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {t("webhook_logs_subheader", activeIsRtl ? "سجل تدقيق الطلبات الخارجية، وأكواد استجابة HTTP، وزمن الاستجابة." : "Audit trail of outbound HTTP requests, response status codes, and latency.")}
            </p>
          </div>
          <span className="text-xs font-extrabold text-slate-400">
            {activeIsRtl ? `عرض آخر ${logs.length} عملية إرسال` : `Showing last ${logs.length} dispatches`}
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs font-semibold">
            {t("no_logs", activeIsRtl ? "لا توجد سجلات إرسال حتى الآن. قم بإنشاء نقطة نهاية أو إجراء اختبار لإطلاق الأحداث." : "No webhook dispatch logs recorded yet. Create an endpoint or run a test to trigger events.")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-extrabold">
                  <th className="pb-3 text-start">{t("log_status", activeIsRtl ? "الحالة" : "Status")}</th>
                  <th className="pb-3 text-start">{t("log_event", activeIsRtl ? "الحدث" : "Event")}</th>
                  <th className="pb-3 text-start">{t("log_endpoint", activeIsRtl ? "نقطة النهاية" : "Webhook / Endpoint")}</th>
                  <th className="pb-3 text-start">{t("log_latency", activeIsRtl ? "زمن الاستجابة" : "Latency")}</th>
                  <th className="pb-3 text-start">{t("log_time", activeIsRtl ? "الوقت" : "Time")}</th>
                  <th className="pb-3 text-end">{t("log_actions", activeIsRtl ? "الإجراءات" : "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-black text-[10px] ${
                          log.success
                            ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40"
                            : "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40"
                        }`}
                      >
                        {log.success ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <XCircle className="w-3 h-3 text-rose-500" />
                        )}
                        <span className="font-mono dir-ltr">{log.statusCode ? `HTTP ${log.statusCode}` : "Failed"}</span>
                      </span>
                    </td>

                    <td className="py-3 font-extrabold text-slate-800 dark:text-slate-200">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[10px] dir-ltr inline-block">
                        {log.event}
                      </span>
                    </td>

                    <td className="py-3 max-w-xs truncate text-slate-600 dark:text-slate-400 font-medium">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {log.webhookName || "Webhook"}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 truncate dir-ltr text-left" dir="ltr">{log.url}</div>
                    </td>

                    <td className="py-3 font-mono text-slate-500 font-bold dir-ltr text-left" dir="ltr">
                      {log.durationMs} ms
                    </td>

                    <td className="py-3 text-slate-400 font-medium whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>

                    <td className="py-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setInspectingLog(log)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-all"
                          title="Inspect payload"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{activeIsRtl ? "معاينة" : "Inspect"}</span>
                        </button>

                        <button
                          onClick={() => handleResendLog(log)}
                          disabled={actionLoading}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer transition-all"
                          title="Retry delivery"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Integration Setup Guides & Sample JSON Payloads */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>{t("webhook_guide_header", activeIsRtl ? "أدلة الربط ونماذج الحمولة (JSON)" : "Integration Guides & Sample Payloads")}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {t("webhook_guide_subheader", activeIsRtl ? "انسخ نماذج JSON مباشرة لاستخدامها في Zapier Catch Hooks أو سيناريوهات Make أو خوادمك المخصصة." : "Copy JSON structures directly into Zapier Catch Hooks, Make scenarios, or custom servers.")}
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(["zapier", "make", "hubspot", "custom"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveGuideTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeGuideTab === tab
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Instructions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {activeGuideTab === "zapier" && (
              <div className="space-y-3">
                <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-xs">Z</span>
                  <span>{activeIsRtl ? "إعداد الربط مع Zapier" : "Zapier Integration Setup"}</span>
                </div>
                {activeIsRtl ? (
                  <ol className="list-decimal list-inside space-y-2 font-medium leading-relaxed">
                    <li>أنشئ Zap جديداً في Zapier واختر <strong className="font-bold text-slate-900 dark:text-white">Webhooks by Zapier</strong> كـ Trigger.</li>
                    <li>اختر الحدث: <strong className="font-bold text-slate-900 dark:text-white">Catch Hook</strong> وانقر على متابعة (Continue).</li>
                    <li>انسخ رابط الـ Webhook الفريد الموفر من Zapier.</li>
                    <li>الصق الرابط في نموذج <strong className="font-bold text-slate-900 dark:text-white">إضافة نقطة نهاية Webhook</strong> أعلاه.</li>
                    <li>انقر على <strong className="font-bold text-slate-900 dark:text-white">اختبار</strong> في اللوحة لإرسال حمولة تجريبية.</li>
                    <li>سيتعرف Zapier تلقائياً على البيانات ويربطها بالتطبيقات الأخرى (Google Sheets, SMS, Slack, HubSpot).</li>
                  </ol>
                ) : (
                  <ol className="list-decimal list-inside space-y-2 font-medium dir-ltr text-left" dir="ltr">
                    <li>Create a new Zap on Zapier and select <strong>Webhooks by Zapier</strong> as the Trigger.</li>
                    <li>Choose the Event: <strong>Catch Hook</strong> and click Continue.</li>
                    <li>Copy the unique Webhook URL provided by Zapier.</li>
                    <li>Paste the Zapier URL into the <strong>Add Webhook Endpoint</strong> form above in this dashboard.</li>
                    <li>Click <strong>Test</strong> in this dashboard to dispatch a sample payload.</li>
                    <li>Zapier will automatically detect the data fields and map them to downstream apps (Google Sheets, SMS, Slack, HubSpot).</li>
                  </ol>
                )}
              </div>
            )}

            {activeGuideTab === "make" && (
              <div className="space-y-3">
                <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs">M</span>
                  <span>{activeIsRtl ? "إعداد Make.com (Integromat)" : "Make.com (Integromat) Setup"}</span>
                </div>
                {activeIsRtl ? (
                  <ol className="list-decimal list-inside space-y-2 font-medium leading-relaxed">
                    <li>أنشئ سيناريو جديداً في Make.com وأضف وحدة <strong className="font-bold text-slate-900 dark:text-white">Custom Webhook</strong>.</li>
                    <li>انسخ رابط Webhook المولد من Make.</li>
                    <li>قم بإعداد نقطة النهاية هنا في لوحة التحكم وفعّل أحداث الإطلاق مثل <code className="font-mono dir-ltr inline-block px-1 bg-slate-100 dark:bg-slate-800 rounded">ticket.calling</code>.</li>
                    <li>أرسل حدث اختبار للتعرف التلقائي على هيكل البيانات في Make.</li>
                  </ol>
                ) : (
                  <ol className="list-decimal list-inside space-y-2 font-medium dir-ltr text-left" dir="ltr">
                    <li>Create a new Scenario in Make.com and add a <strong>Custom Webhook</strong> module.</li>
                    <li>Copy the generated Make webhook URL.</li>
                    <li>Configure the endpoint here in Dork Vendor Dashboard and enable triggers like <code>ticket.calling</code>.</li>
                    <li>Dispatch a test event to automatically determine the data structure in Make.</li>
                  </ol>
                )}
              </div>
            )}

            {activeGuideTab === "hubspot" && (
              <div className="space-y-3">
                <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs">H</span>
                  <span>{activeIsRtl ? "مزامنة HubSpot / Salesforce CRM" : "HubSpot / Salesforce CRM Sync"}</span>
                </div>
                <p className="font-medium leading-relaxed">
                  {activeIsRtl
                    ? "قم بمزامنة بيانات تسجيل حضور العملاء مباشرة مع جهات الاتصال في نظام إدارة علاقات العملاء (CRM). استخدم الترويسات المخصصة في إعداد نقطة النهاية لإرفاق رمز API الخاص بنظام CRM."
                    : "Sync customer check-in details directly with your CRM contacts. Use custom headers in the endpoint configuration to attach your CRM API token (e.g., Authorization: Bearer <token>)."}
                </p>
              </div>
            )}

            {activeGuideTab === "custom" && (
              <div className="space-y-3">
                <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-indigo-500" />
                  <span>{activeIsRtl ? "خادم API مخصص (Node / Python)" : "Custom Node/Python API Server"}</span>
                </div>
                <p className="font-medium">
                  {activeIsRtl
                    ? "يتلقى خادمك طلبات POST مع الترويسة Content-Type: application/json وترويسات الأمان:"
                    : "Your server receives POST requests with Content-Type: application/json and headers:"}
                </p>
                <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 dir-ltr text-left" dir="ltr">
                  <li><code>X-Dork-Event</code>: Event trigger name</li>
                  <li><code>X-Dork-Delivery</code>: Unique delivery ID</li>
                  <li><code>X-Dork-Signature</code>: HMAC SHA-256 hex signature (if secret key set)</li>
                </ul>
              </div>
            )}
          </div>

          {/* Sample Payload Preview */}
          <div className="lg:col-span-7 bg-slate-950 text-slate-100 rounded-2xl p-4 border border-slate-800 space-y-3 dir-ltr text-left" dir="ltr">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-indigo-400 font-bold flex items-center gap-2">
                <Code className="w-4 h-4" />
                <span>Sample Payload: ticket.created</span>
              </span>

              <button
                onClick={() => copyToClipboard(getSamplePayloadForEvent("ticket.created"), "ticket.created")}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-xs font-bold border border-indigo-500/30 transition-all cursor-pointer"
              >
                {copiedPayloadEvent === "ticket.created" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{activeIsRtl ? "تم النسخ!" : "Copied!"}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{activeIsRtl ? "نسخ JSON" : "Copy JSON"}</span>
                  </>
                )}
              </button>
            </div>

            <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto text-emerald-400 bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 max-h-60 dir-ltr text-left" dir="ltr">
              {getSamplePayloadForEvent("ticket.created")}
            </pre>
          </div>
        </div>
      </div>

      {/* --- ADD / EDIT WEBHOOK MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Globe className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  <span>{editingWebhook ? t("edit_webhook", "Edit Webhook Endpoint") : t("add_webhook", "Add Webhook Endpoint")}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {t("webhook_modal_sub", "Configure target URL and real-time event triggers.")}
                </p>
              </div>

              <button
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveWebhook} className="space-y-5">
              {/* Endpoint Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  {t("webhook_name_label", "Endpoint Name / Label")}
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Zapier Customer Intake, HubSpot CRM, Slack Bot"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {/* Target URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  {t("webhook_url_label", "Target Webhook URL")}
                </label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/12345/abcde/"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {/* Secret Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{t("webhook_secret_label", "HMAC Secret Key (Optional)")}</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-400">Generates X-Dork-Signature</span>
                </div>
                <input
                  type="text"
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                  placeholder="whsec_0123456789abcdef..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Event Triggers Checkboxes */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block">
                  {t("webhook_triggers_label", "Subscribed Queue Event Triggers")}
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {ALL_EVENTS.map((evt) => {
                    const isChecked = formEvents.includes(evt.id);
                    return (
                      <button
                        type="button"
                        key={evt.id}
                        onClick={() => toggleEventSelection(evt.id)}
                        className={`p-3 rounded-xl border text-start transition-all cursor-pointer flex items-start gap-2.5 ${
                          isChecked
                            ? "bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-500 text-indigo-900 dark:text-indigo-200"
                            : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="space-y-0.5 min-w-0">
                          <div className="text-xs font-black leading-snug">
                            {isRtl ? evt.labelAr : evt.labelEn}
                          </div>
                          <div className="text-[10px] text-slate-400 leading-tight">
                            {evt.id}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Headers Editor */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                    {t("webhook_headers_label", "Custom HTTP Headers (Optional)")}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddHeader}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Header</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {formHeaders.map((hdr, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Header Key (e.g. Authorization)"
                        value={hdr.key}
                        onChange={(e) => handleUpdateHeader(idx, "key", e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold"
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. Bearer token)"
                        value={hdr.value}
                        onChange={(e) => handleUpdateHeader(idx, "value", e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveHeader(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  {t("cancel", "Cancel")}
                </button>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  <span>{editingWebhook ? t("save_changes", "Save Changes") : t("create_webhook", "Create Endpoint")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- TEST WEBHOOK MODAL --- */}
      {testingWebhook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Play className="w-5 h-5 text-emerald-500 fill-emerald-500" />
                  <span>{activeIsRtl ? "اختبار إرسال حمولة Webhook" : "Test Webhook Payload Dispatch"}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {activeIsRtl ? "نقطة النهاية:" : "Endpoint:"} <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold dir-ltr inline-block">{testingWebhook.name}</span>
                </p>
              </div>

              <button
                onClick={closeTestModal}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  {activeIsRtl ? "اختر حدث الطابور للتحاكي:" : "Select Event Trigger to Simulate"}
                </label>
                <select
                  value={testEvent}
                  onChange={(e) => setTestEvent(e.target.value as WebhookEvent)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold font-mono dir-ltr"
                >
                  {testingWebhook.events.map((evt) => (
                    <option key={evt} value={evt}>
                      {evt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-950 text-slate-100 p-4 rounded-2xl space-y-2 border border-slate-800 dir-ltr text-left" dir="ltr">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  Simulated Target URL:
                </span>
                <div className="font-mono text-xs text-emerald-400 break-all">{testingWebhook.url}</div>
              </div>

              {testResult && (
                <div
                  className={`p-4 rounded-2xl border space-y-3 ${
                    testResult.success
                      ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50"
                      : "bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded-full font-mono dir-ltr ${
                        testResult.success
                          ? "bg-emerald-500 text-white"
                          : "bg-rose-500 text-white"
                      }`}
                    >
                      {testResult.statusCode ? `HTTP ${testResult.statusCode}` : (activeIsRtl ? "فشل الاتصال" : "Connection Failed")}
                    </span>

                    <span className="text-xs font-mono font-bold text-slate-500 dir-ltr">
                      {activeIsRtl ? "زمن الاستجابة:" : "Latency:"} {testResult.durationMs} ms
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {activeIsRtl ? "ملخص استجابة الخادم:" : "Server Response Summary:"}
                    </span>
                    <p className="text-xs font-mono text-slate-800 dark:text-slate-200 break-all bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800 dir-ltr text-left" dir="ltr">
                      {testResult.responseSummary}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={closeTestModal}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                {t("close", activeIsRtl ? "إغلاق" : "Close")}
              </button>

              <button
                onClick={handleRunTest}
                disabled={isTesting}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                <span>{isTesting ? (activeIsRtl ? "جاري الإرسال..." : "Dispatching...") : (activeIsRtl ? "إرسال حمولة الاختبار" : "Send Test Payload")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- INSPECT LOG PAYLOAD MODAL --- */}
      {inspectingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-indigo-500" />
                  <span>{activeIsRtl ? "معاينة حمولة Webhook المرسلة" : "Inspect Webhook Dispatch Payload"}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {activeIsRtl ? "معرف الإرسال:" : "Delivery ID:"} <span className="font-mono text-indigo-500 dir-ltr inline-block">{inspectingLog.id}</span>
                </p>
              </div>

              <button
                onClick={() => setInspectingLog(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">{activeIsRtl ? "الحدث:" : "Event:"}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white dir-ltr inline-block">{inspectingLog.event}</span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">{activeIsRtl ? "رمز الحالة:" : "Status Code:"}</span>
                  <span className={`font-mono font-black dir-ltr inline-block ${inspectingLog.success ? "text-emerald-500" : "text-rose-500"}`}>
                    HTTP {inspectingLog.statusCode || "Error"}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">{activeIsRtl ? "نقطة النهاية الهدف:" : "Target Endpoint:"}</span>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 break-all dir-ltr text-left" dir="ltr">
                  {inspectingLog.url}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">{activeIsRtl ? "حمولة الـ JSON المرسلة:" : "Payload JSON Sent:"}</span>
                <pre className="p-4 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto max-h-64 border border-slate-800 dir-ltr text-left" dir="ltr">
                  {JSON.stringify(inspectingLog.payload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setInspectingLog(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all cursor-pointer"
              >
                {t("close", activeIsRtl ? "إغلاق" : "Close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
