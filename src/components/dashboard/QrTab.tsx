import React, { useState, useEffect, useRef } from "react";
import { 
  QrCode, Copy, Check, Download, Info, Clock, Save, 
  Upload, Scissors, Stethoscope, Landmark, PhoneCall, UtensilsCrossed, HelpCircle,
  Printer, Palette, Sparkles, Image as ImageIcon, X, ExternalLink, Smartphone, CheckCircle2
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Shop, WorkingHoursDay } from "../../types";
import { getAppOrigin } from "../../lib/originUtils";
import QRCode from "qrcode";

interface QrTabProps {
  shop: Shop | null;
  copied: boolean;
  handleCopyLink: () => void;
  handleDownloadQR: () => void;
  editShopName: string;
  setEditShopName: (val: string) => void;
  editShopLogoText: string;
  setEditShopLogoText: (val: string) => void;
  editShopCategory: string;
  setEditShopCategory: (val: string) => void;
  editShopLogoUrl: string;
  setEditShopLogoUrl: (val: string) => void;
  editShopTicketColor: string;
  setEditShopTicketColor: (val: string) => void;
  settingsSaving: boolean;
  dragActive: boolean;
  workingHoursEnabled: boolean;
  setWorkingHoursEnabled: (val: boolean) => void;
  workingHoursDays: { [key: string]: WorkingHoursDay };
  setWorkingHoursDays: (val: { [key: string]: WorkingHoursDay }) => void;
  handleUpdateSettings: (e: React.FormEvent) => void;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
  voiceAnnouncementsEnabled: boolean;
  setVoiceAnnouncementsEnabled: (val: boolean) => void;
  voiceLanguage: string;
  setVoiceLanguage: (val: string) => void;
  voiceRate: number;
  setVoiceRate: (val: number) => void;
  browserNotificationsEnabled: boolean;
  maxWaitTimeAlertMinutes: number;
  setMaxWaitTimeAlertMinutes: (val: number) => void;
  handleToggleBrowserNotifications: () => void;
  handleSendTestNotification: () => void;
  isRtl: boolean;
}

export function QrTab({
  shop,
  copied,
  handleCopyLink,
  handleDownloadQR,
  editShopName,
  setEditShopName,
  editShopLogoText,
  setEditShopLogoText,
  editShopCategory,
  setEditShopCategory,
  editShopLogoUrl,
  setEditShopLogoUrl,
  editShopTicketColor,
  setEditShopTicketColor,
  settingsSaving,
  dragActive,
  workingHoursEnabled,
  setWorkingHoursEnabled,
  workingHoursDays,
  setWorkingHoursDays,
  handleUpdateSettings,
  handleDrag,
  handleDrop,
  handleFileChange,
  soundEnabled,
  setSoundEnabled,
  voiceAnnouncementsEnabled,
  setVoiceAnnouncementsEnabled,
  voiceLanguage,
  setVoiceLanguage,
  voiceRate,
  setVoiceRate,
  browserNotificationsEnabled,
  maxWaitTimeAlertMinutes,
  setMaxWaitTimeAlertMinutes,
  handleToggleBrowserNotifications,
  handleSendTestNotification,
  isRtl
}: QrTabProps) {
  const { t } = useTranslation();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [qrFgColor, setQrFgColor] = useState<string>("#0f172a");
  const [qrBgColor, setQrBgColor] = useState<string>("#ffffff");
  const [showLogoOverlay, setShowLogoOverlay] = useState<boolean>(true);
  const [showPosterModal, setShowPosterModal] = useState<boolean>(false);
  const [isExportingPoster, setIsExportingPoster] = useState<boolean>(false);

  const posterRef = useRef<HTMLDivElement>(null);

  // Sync QR color with shop ticket color initially if unchanged
  useEffect(() => {
    if (editShopTicketColor && qrFgColor === "#0f172a") {
      setQrFgColor(editShopTicketColor);
    }
  }, [editShopTicketColor]);

  // Generate dynamic unique QR code data URL whenever slug or color options change
  useEffect(() => {
    if (shop?.slug) {
      const targetUrl = `${getAppOrigin()}/portal/${encodeURIComponent(shop.slug)}?src=qr_entrance`;
      QRCode.toDataURL(
        targetUrl,
        {
          width: 600,
          margin: 1,
          color: {
            dark: qrFgColor || "#0f172a",
            light: qrBgColor || "#ffffff",
          },
        },
        (err, dataUrl) => {
          if (err) {
            console.error("Failed to generate dynamic QR Code:", err);
            return;
          }
          setQrCodeDataUrl(dataUrl);
        }
      );
    }
  }, [shop?.slug, qrFgColor, qrBgColor]);

  // Download Standalone High-Res QR PNG
  const downloadQrCodeImage = () => {
    if (!qrCodeDataUrl || !shop?.slug) return;
    const link = document.createElement("a");
    link.href = qrCodeDataUrl;
    link.download = `qr_code_${shop.slug}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate and Download Complete High-Res Printable Entrance Poster Card on HTML5 Canvas
  const downloadPosterImage = async () => {
    if (!shop?.slug || !qrCodeDataUrl) return;
    setIsExportingPoster(true);

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // High-resolution A4-proportioned poster canvas
      const width = 1200;
      const height = 1600;
      canvas.width = width;
      canvas.height = height;

      // 1. Background Fill
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // 2. Top Header Accent Banner
      const accentColor = editShopTicketColor || qrFgColor || "#4f46e5";
      ctx.fillStyle = accentColor;
      ctx.fillRect(0, 0, width, 24);

      // Gradient Header Area
      const grad = ctx.createLinearGradient(0, 24, 0, 360);
      grad.addColorStop(0, "#0f172a");
      grad.addColorStop(1, "#1e293b");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 24, width, 336);

      // Subtle Decorative Circle in header
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.beginPath();
      ctx.arc(width / 2, 190, 260, 0, Math.PI * 2);
      ctx.fill();

      // 3. Shop Title & Subtitle in Header
      const displayShopName = editShopName || shop.name || "صالون ومركز الانتظار";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 56px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(displayShopName, width / 2, 140);

      const displayCategory = editShopLogoText || shop.logoText || "طابور إلكتروني منظم - انضم بنقرة واحدة";
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
      ctx.fillText(displayCategory, width / 2, 200);

      // Header Tagline Badge
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.roundRect(width / 2 - 280, 240, 560, 50, 25);
      ctx.fill();

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
      ctx.fillText(t("qr_poster_scan_title", "امسح الرمز للحصول على رقم دورك"), width / 2, 273);

      // 4. White Card for QR Code
      const cardX = 150;
      const cardY = 400;
      const cardW = 900;
      const cardH = 750;

      // Card Shadow & Border
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(15, 23, 42, 0.08)";
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 20;
      ctx.roundRect(cardX, cardY, cardW, cardH, 36);
      ctx.fill();

      ctx.shadowColor = "transparent"; // Reset shadow
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Load & Draw QR Code Image
      const qrImg = new Image();
      qrImg.crossOrigin = "anonymous";
      qrImg.src = qrCodeDataUrl;
      await new Promise((resolve) => {
        qrImg.onload = resolve;
      });

      const qrSize = 480;
      const qrX = width / 2 - qrSize / 2;
      const qrY = cardY + 70;
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // Optional Logo Overlay in Center of QR Code
      if (showLogoOverlay && (editShopLogoUrl || shop.logoUrl)) {
        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        logoImg.src = editShopLogoUrl || shop.logoUrl || "";
        await new Promise((resolve) => {
          logoImg.onload = resolve;
          logoImg.onerror = resolve; // Continue if error
        });

        if (logoImg.complete && logoImg.naturalWidth > 0) {
          const logoSize = 100;
          const logoX = width / 2 - logoSize / 2;
          const logoY = qrY + qrSize / 2 - logoSize / 2;

          // White background circle behind logo
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(width / 2, qrY + qrSize / 2, logoSize / 2 + 10, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = accentColor;
          ctx.lineWidth = 4;
          ctx.stroke();

          // Draw clipped circular logo
          ctx.save();
          ctx.beginPath();
          ctx.arc(width / 2, qrY + qrSize / 2, logoSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
          ctx.restore();
        }
      }

      // Instruction Text below QR
      ctx.fillStyle = "#0f172a";
      ctx.font = "black 32px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(t("qr_poster_scan_sub", "طابور إلكتروني منظم - انضم بنقرة واحدة بدون عناء الانتظار"), width / 2, cardY + 610);

      // Public URL Display
      const portalUrl = `${getAppOrigin()}/portal/${encodeURIComponent(shop.slug)}`;
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 22px monospace";
      ctx.fillText(portalUrl, width / 2, cardY + 670);

      // 5. 3 Step Guidance Cards
      const stepY = 1200;
      const stepW = 320;
      const stepGap = 40;
      const startX = (width - (stepW * 3 + stepGap * 2)) / 2;

      const stepsData = [
        { title: t("qr_poster_step1_title", "1. امسح الرمز"), desc: t("qr_poster_step1_desc", "افتح كاميرا هاتفك ووجهها نحو الرمز") },
        { title: t("qr_poster_step2_title", "2. اختر الخدمة"), desc: t("qr_poster_step2_desc", "اختر نوع الخدمة واقطع تذكرتك الإلكترونية") },
        { title: t("qr_poster_step3_title", "3. تابع دورك"), desc: t("qr_poster_step3_desc", "تلقى تنبيهات حية فور اقتراب نداء دورك") }
      ];

      stepsData.forEach((s, idx) => {
        const sx = startX + idx * (stepW + stepGap);
        ctx.fillStyle = "#f8fafc";
        ctx.roundRect(sx, stepY, stepW, 200, 24);
        ctx.fill();

        ctx.strokeStyle = "#f1f5f9";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = accentColor;
        ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(s.title, sx + stepW / 2, stepY + 60);

        ctx.fillStyle = "#64748b";
        ctx.font = "500 18px system-ui, -apple-system, sans-serif";
        
        // Wrap text
        const words = s.desc.split(" ");
        let line = "";
        let lineY = stepY + 110;
        for (let w = 0; w < words.length; w++) {
          const testLine = line + words[w] + " ";
          if (ctx.measureText(testLine).width > stepW - 30 && w > 0) {
            ctx.fillText(line, sx + stepW / 2, lineY);
            line = words[w] + " ";
            lineY += 28;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, sx + stepW / 2, lineY);
      });

      // 6. Footer
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 1480, width, 120);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
      ctx.fillText(t("qr_poster_footer", "أهلاً وسهلاً بكم • نظام إدارة الطوابير الذكي"), width / 2, 1530);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 18px monospace";
      ctx.fillText("Dork Digital Queue Platform", width / 2, 1570);

      // Save image
      const dataUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = dataUrl;
      downloadLink.download = `entrance_poster_${shop.slug}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      console.error("Failed to render canvas entrance poster:", err);
    } finally {
      setIsExportingPoster(false);
    }
  };

  // Direct Window Print Handler
  const handlePrintPosterNow = () => {
    window.print();
  };

  const handleWorkingHoursDayToggle = (dayKey: string) => {
    const updated = { ...workingHoursDays };
    updated[dayKey] = {
      ...updated[dayKey],
      enabled: !updated[dayKey].enabled
    };
    setWorkingHoursDays(updated);
  };

  const handleWorkingHoursTimeChange = (dayKey: string, field: "open" | "close", value: string) => {
    const updated = { ...workingHoursDays };
    updated[dayKey] = {
      ...updated[dayKey],
      [field]: value
    };
    setWorkingHoursDays(updated);
  };

  const daysOfWeek = [
    { key: "1", label: t("day_monday", "Monday") },
    { key: "2", label: t("day_tuesday", "Tuesday") },
    { key: "3", label: t("day_wednesday", "Wednesday") },
    { key: "4", label: t("day_thursday", "Thursday") },
    { key: "5", label: t("day_friday", "Friday") },
    { key: "6", label: t("day_saturday", "Saturday") },
    { key: "0", label: t("day_sunday", "Sunday") }
  ];

  return (
    <div className="space-y-6 animate-fade-in animate-duration-200" id="qr-settings-tab">
      
      {/* Printable Poster CSS rules */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-entrance-poster, #printable-entrance-poster * {
            visibility: visible;
          }
          #printable-entrance-poster {
            position: fixed;
            left: 0;
            top: 0;
            width: 100vw;
            height: 100vh;
            margin: 0;
            padding: 2rem;
            background: white !important;
            z-index: 99999;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
          }
        }
      `}</style>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: QR Code Generator & Entrance Poster Actions */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm text-center space-y-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {t("vend_digital_counter_header", "Digital Queue Access")}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
                {t("vend_digital_counter_desc", "Customers can scan this QR code or use the link to join your waiting list, verify estimated times, and track their turn dynamically from their phones.")}
              </p>
            </div>

            {/* Dynamic QR Code Canvas Visual Display */}
            <div className="relative inline-block bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-900/60 shadow-inner group">
              <div id="qr-code-element" className="relative z-10 p-3 bg-white rounded-2xl shadow-sm">
                {shop?.slug && qrCodeDataUrl ? (
                  <div className="relative inline-block">
                    <img 
                      src={qrCodeDataUrl}
                      alt="Customer Portal Dynamic QR Code"
                      className="w-44 h-44 object-contain mx-auto rounded-lg"
                    />
                    {showLogoOverlay && (editShopLogoUrl || shop?.logoUrl) && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-10 h-10 rounded-full bg-white p-1 shadow-md border-2 border-indigo-500 flex items-center justify-center overflow-hidden">
                          <img 
                            src={editShopLogoUrl || shop?.logoUrl} 
                            alt="Shop Logo" 
                            className="w-full h-full object-cover rounded-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-44 h-44 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 text-[10px] font-bold">
                    {t("vend_loading_qr_slug", "Loading Link...")}
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-indigo-600/5 dark:bg-indigo-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>

            {/* Customization Options Bar */}
            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80 space-y-3 text-start">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{t("qr_customize_title", "Customize QR Code Styling")}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-1">
                    {t("qr_color_fg", "QR Modules Color")}
                  </label>
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1.5 rounded-xl">
                    <input 
                      type="color" 
                      value={qrFgColor} 
                      onChange={(e) => setQrFgColor(e.target.value)}
                      className="w-6 h-6 rounded-lg border-0 p-0 cursor-pointer"
                    />
                    <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">{qrFgColor}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-1">
                    {t("qr_color_bg", "Background Color")}
                  </label>
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1.5 rounded-xl">
                    <input 
                      type="color" 
                      value={qrBgColor} 
                      onChange={(e) => setQrBgColor(e.target.value)}
                      className="w-6 h-6 rounded-lg border-0 p-0 cursor-pointer"
                    />
                    <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">{qrBgColor}</span>
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={showLogoOverlay} 
                  onChange={(e) => setShowLogoOverlay(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t("qr_show_logo", "Embed Shop Logo in Center")}
                </span>
              </label>
            </div>

            {/* Copy Link & Action Buttons */}
            <div className="space-y-3">
              {/* Public Link Copy Input */}
              <div className="relative">
                <input 
                  type="text"
                  readOnly
                  value={shop?.slug ? `${getAppOrigin()}/portal/${encodeURIComponent(shop.slug)}` : ""}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 px-4 py-3.5 pe-24 rounded-2xl text-[11px] font-black focus:outline-none focus:ring-0 truncate font-mono dir-ltr text-left"
                  dir="ltr"
                />
                <button
                  onClick={handleCopyLink}
                  className="absolute end-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] px-3.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow"
                  id="btn-copy-link"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>{t("btn_copied", "Copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>{t("btn_copy", "Copy Link")}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Primary Action 1: Print & Preview Entrance Poster */}
              <button
                onClick={() => setShowPosterModal(true)}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-xs py-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-100 dark:shadow-none"
                id="btn-preview-poster"
              >
                <Printer className="w-4 h-4" />
                <span>{t("qr_entrance_poster_btn", "Preview & Print Entrance Poster")}</span>
              </button>

              {/* Action 2: Download High-Res Entrance Poster PNG */}
              <button
                onClick={downloadPosterImage}
                disabled={isExportingPoster}
                className="w-full border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 font-extrabold text-xs py-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                id="btn-download-poster-png"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                <span>{isExportingPoster ? "جاري إنشاء البوستر..." : t("qr_download_poster_png", "Download Printable Poster Card (PNG)")}</span>
              </button>

              {/* Action 3: Download Standalone QR Code Only */}
              <button
                onClick={downloadQrCodeImage}
                className="w-full border border-slate-200/80 dark:border-slate-800/80 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold text-[11px] py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                id="btn-download-qr-only"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{t("qr_download_code_only", "Download Standalone QR Code (PNG)")}</span>
              </button>
            </div>
          </div>

          {/* Quick Notice Card */}
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 p-5 rounded-3xl flex gap-3">
            <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="text-xs font-black text-slate-800 dark:text-white">
                {t("vend_qr_notice_title", "Custom Branding")}
              </h5>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {t("vend_qr_notice_body", "If you update your logo image or brand text inside settings, the customer onboarding portal will adapt immediately to match your style parameters.")}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: General Settings Form & Timing Schedule */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleUpdateSettings} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>{t("vend_settings_form_title", "Shop Branding & Profile Setup")}</span>
              </h3>
              <button
                type="submit"
                disabled={settingsSaving}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow"
                id="btn-save-settings"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t("btn_save_changes", "Save Changes")}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {t("vend_field_shop_name_label", "Shop / Business Name")}
                </label>
                <input 
                  type="text"
                  value={editShopName}
                  onChange={(e) => setEditShopName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {t("vend_field_logo_text_label", "Brand Logo Slogan / Text")}
                </label>
                <input 
                  type="text"
                  value={editShopLogoText}
                  onChange={(e) => setEditShopLogoText(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {t("vend_field_category_label", "Business Category")}
                </label>
                <select
                  value={editShopCategory}
                  onChange={(e) => setEditShopCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="barber">💇‍♂️ {t("cat_barber_salon", "Barber & Beauty Salon")}</option>
                  <option value="medical">🩺 {t("cat_medical_clinic", "Medical & Clinics")}</option>
                  <option value="government">🏛️ {t("cat_gov_offices", "Government & Offices")}</option>
                  <option value="telecom">📱 {t("cat_telecom_retail", "Telecom & Retail Stores")}</option>
                  <option value="food">🍔 {t("cat_food_beverage", "Restaurants & Cafés")}</option>
                  <option value="other">📦 {t("cat_other_services", "Other Support Services")}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>{t("vend_field_ticket_color_label", "Ticket Visual Color")}</span>
                  <span className="text-[11px] font-mono font-black" style={{ color: editShopTicketColor }}>{editShopTicketColor}</span>
                </label>
                <div className="flex gap-2">
                  <input 
                    type="color"
                    value={editShopTicketColor}
                    onChange={(e) => setEditShopTicketColor(e.target.value)}
                    className="w-12 h-10 p-0.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
                  />
                  <div className="grid grid-cols-5 gap-1.5 flex-1">
                    {["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e"].map((colorHex) => (
                      <button
                        key={colorHex}
                        type="button"
                        onClick={() => setEditShopTicketColor(colorHex)}
                        className="h-10 rounded-xl border border-transparent transition-transform hover:scale-105"
                        style={{ backgroundColor: colorHex }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Logo Uploading File drag-drop area */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                {t("vend_field_logo_url_label", "Shop Logo Image")}
              </label>
              
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all relative overflow-hidden ${
                  dragActive 
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20" 
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                }`}
              >
                <input 
                  type="file"
                  id="logo-file-input"
                  onChange={handleFileChange}
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />

                {editShopLogoUrl ? (
                  <div className="flex items-center justify-center gap-4">
                    <img 
                      src={editShopLogoUrl}
                      alt="Brand Logo Preview"
                      className="w-16 h-16 rounded-2xl object-cover border border-slate-100 shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                    <div className="text-left space-y-1">
                      <p className="text-xs font-black text-slate-800 dark:text-white">
                        {t("vend_logo_preview_title", "Logo uploaded successfully!")}
                      </p>
                      <button 
                        type="button"
                        onClick={() => setEditShopLogoUrl("")}
                        className="text-[10px] text-rose-500 hover:text-rose-600 font-extrabold underline cursor-pointer"
                      >
                        {t("vend_btn_remove_logo", "Remove & Reset")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-xs">
                      <span className="font-black text-indigo-600 dark:text-indigo-400">
                        {t("vend_logo_upload_prompt", "Click to upload image")}
                      </span>{" "}
                      {t("vend_logo_upload_drag", "or drag & drop here")}
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {t("vend_logo_size_limit", "PNG, JPG up to 1MB")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Timing Working Hours Scheduling */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    {t("vend_working_hours_title", "Working Hours Schedule")}
                  </h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {t("vend_working_hours_desc", "Configure days and open ranges when customers can pull tickets. Beyond hours, requests are denied.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWorkingHoursEnabled(!workingHoursEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                    workingHoursEnabled ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                >
                  <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${
                    workingHoursEnabled ? "start-6" : "start-1"
                  }`} />
                </button>
              </div>

              {workingHoursEnabled && (
                <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-3xl border border-slate-150 dark:border-slate-800/60 space-y-3">
                  {daysOfWeek.map(({ key, label }) => {
                    const dayConfig = workingHoursDays[key] || { enabled: false, open: "09:00", close: "22:00" };
                    return (
                      <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox"
                            checked={dayConfig.enabled}
                            onChange={() => handleWorkingHoursDayToggle(key)}
                            className="w-4 h-4 text-indigo-600 border-slate-200 rounded focus:ring-indigo-500"
                          />
                          <span className="text-xs font-black text-slate-800 dark:text-slate-300">{label}</span>
                        </div>

                        {dayConfig.enabled ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="time"
                              value={dayConfig.open}
                              onChange={(e) => handleWorkingHoursTimeChange(key, "open", e.target.value)}
                              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-400 font-extrabold">{t("time_to_divider", "to")}</span>
                            <input 
                              type="time"
                              value={dayConfig.close}
                              onChange={(e) => handleWorkingHoursTimeChange(key, "close", e.target.value)}
                              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-extrabold italic uppercase">
                            {t("day_closed_status", "Closed / Day Off")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Audio Voice Announcements & Browser Alerts Controls */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-6">
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-slate-900 dark:text-white">
                  {t("vend_sound_settings_title", "Sound Chimes, Voices & Popups")}
                </h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {t("vend_sound_settings_desc", "Configure speech parameters, volume, turn approaching limits, and browser push notices to notify clerks of delays.")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Audio chime toggle */}
                <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">{t("vend_sound_toggle_label", "Audio chime sound effects")}</span>
                    <p className="text-[10px] text-slate-400">{t("vend_sound_toggle_desc", "Play bell sound on ticket adds & calls")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                      soundEnabled ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  >
                    <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${
                      soundEnabled ? "start-6" : "start-1"
                    }`} />
                  </button>
                </div>

                {/* Voice Calling toggle */}
                <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">{t("vend_voice_toggle_label", "Voice announcement calling")}</span>
                    <p className="text-[10px] text-slate-400">{t("vend_voice_toggle_desc", "AI synthesis reads numbers aloud")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVoiceAnnouncementsEnabled(!voiceAnnouncementsEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                      voiceAnnouncementsEnabled ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  >
                    <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${
                      voiceAnnouncementsEnabled ? "start-6" : "start-1"
                    }`} />
                  </button>
                </div>
              </div>

              {voiceAnnouncementsEnabled && (
                <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-3xl border border-slate-150 dark:border-slate-800/60 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {t("vend_voice_lang_label", "Calling Announcement Language")}
                      </label>
                      <select
                        value={voiceLanguage}
                        onChange={(e) => setVoiceLanguage(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        <option value="both">🌐 {t("vend_voice_lang_both", "Bilingual (Arabic + English)")}</option>
                        <option value="ar">🇸🇦 {t("vend_voice_lang_ar", "Arabic Only")}</option>
                        <option value="en">🇺🇸 {t("vend_voice_lang_en", "English Only")}</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider flex justify-between">
                        <span>{t("vend_voice_speed_label", "Speech Speed (Rate)")}</span>
                        <span className="font-mono">{voiceRate}x</span>
                      </label>
                      <input 
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={voiceRate}
                        onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                        className="w-full cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none accent-indigo-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Browser Push Popup Alerts Setup */}
              <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-3xl border border-slate-150 dark:border-slate-800/60 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">{t("vend_browser_notifs_title", "Browser Popup Notifications")}</span>
                    <p className="text-[10px] text-slate-400">{t("vend_browser_notifs_desc", "Sends instant dashboard slide alerts for new customer pull events.")}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {browserNotificationsEnabled && (
                      <button
                        type="button"
                        onClick={handleSendTestNotification}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:border-slate-700 font-bold text-[10px] py-1.5 px-3 rounded-lg cursor-pointer transition-colors"
                      >
                        {t("vend_test_push_btn", "Send Test Push")}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleToggleBrowserNotifications}
                      className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                        browserNotificationsEnabled ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                      }`}
                    >
                      <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${
                        browserNotificationsEnabled ? "start-6" : "start-1"
                      }`} />
                    </button>
                  </div>
                </div>

                {browserNotificationsEnabled && (
                  <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-3.5 space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider flex justify-between">
                      <span>{t("vend_max_wait_alert_label", "Max Wait Limit Warning Alert")}</span>
                      <span className="font-mono text-amber-600 font-black">{maxWaitTimeAlertMinutes} {t("time_mins_plural", "minutes")}</span>
                    </label>
                    <input 
                      type="range"
                      min="5"
                      max="60"
                      step="5"
                      value={maxWaitTimeAlertMinutes}
                      onChange={(e) => setMaxWaitTimeAlertMinutes(Number(e.target.value))}
                      className="w-full cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none accent-indigo-600"
                    />
                    <p className="text-[9px] text-slate-400 leading-normal flex items-start gap-1">
                      <HelpCircle className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
                      <span>{t("vend_wait_limit_explanation", "Triggers a browser desktop warning push notification if any waiting client has been waiting in queue longer than this range without being called by your windows.")}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

      </div>

      {/* Entrance Poster Print Preview Modal */}
      {showPosterModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-8">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {t("qr_poster_modal_title", "Printable Entrance Poster Sign")}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("qr_poster_modal_desc", "Print this official poster sign and display it at your store entrance or front desk so customers can self-issue tickets.")}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowPosterModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Printable Poster Design Card */}
            <div 
              ref={posterRef}
              id="printable-entrance-poster"
              className="bg-white text-slate-900 border-4 border-slate-900 rounded-3xl p-6 sm:p-8 space-y-6 text-center shadow-xl relative overflow-hidden"
            >
              {/* Top Accent Stripe */}
              <div className="absolute top-0 inset-x-0 h-3" style={{ backgroundColor: editShopTicketColor || qrFgColor || "#4f46e5" }} />

              {/* Shop Logo & Title */}
              <div className="pt-2 space-y-2">
                {(editShopLogoUrl || shop?.logoUrl) ? (
                  <img 
                    src={editShopLogoUrl || shop?.logoUrl} 
                    alt="Logo" 
                    className="w-16 h-16 rounded-2xl object-cover mx-auto border-2 border-slate-200 shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-black text-2xl flex items-center justify-center mx-auto shadow-md">
                    {(editShopName || shop?.name || "Q").charAt(0)}
                  </div>
                )}

                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                  {editShopName || shop?.name || "اسم المتجر"}
                </h2>
                
                <p className="text-xs sm:text-sm font-extrabold text-slate-500 max-w-md mx-auto">
                  {editShopLogoText || shop?.logoText || t("qr_poster_scan_sub", "طابور إلكتروني منظم - انضم بنقرة واحدة بدون عناء الانتظار")}
                </p>
              </div>

              {/* QR Code Container */}
              <div className="bg-slate-50 border-2 border-slate-200 p-6 rounded-3xl max-w-xs mx-auto space-y-3 shadow-inner">
                <div className="bg-white p-3 rounded-2xl shadow-sm inline-block relative">
                  {qrCodeDataUrl ? (
                    <div className="relative inline-block">
                      <img 
                        src={qrCodeDataUrl} 
                        alt="Entrance QR Code" 
                        className="w-52 h-52 object-contain mx-auto rounded-lg"
                      />
                      {showLogoOverlay && (editShopLogoUrl || shop?.logoUrl) && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-12 h-12 rounded-full bg-white p-1 shadow-md border-2 border-indigo-600 flex items-center justify-center overflow-hidden">
                            <img 
                              src={editShopLogoUrl || shop?.logoUrl} 
                              alt="Shop Logo" 
                              className="w-full h-full object-cover rounded-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-52 h-52 bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">
                      Loading QR...
                    </div>
                  )}
                </div>

                <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-black">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{t("qr_poster_scan_title", "امسح الرمز للحصول على رقم دورك")}</span>
                </div>
              </div>

              {/* 3 Steps Guidance Grid */}
              <div className="grid grid-cols-3 gap-3 text-start">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1">
                  <span className="text-xs font-black text-indigo-600 block">{t("qr_poster_step1_title", "1. امسح الرمز")}</span>
                  <p className="text-[10px] font-semibold text-slate-600 leading-snug">{t("qr_poster_step1_desc", "افتح كاميرا هاتفك ووجهها نحو الرمز")}</p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1">
                  <span className="text-xs font-black text-indigo-600 block">{t("qr_poster_step2_title", "2. اختر الخدمة")}</span>
                  <p className="text-[10px] font-semibold text-slate-600 leading-snug">{t("qr_poster_step2_desc", "اختر نوع الخدمة واقطع تذكرتك الإلكترونية")}</p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1">
                  <span className="text-xs font-black text-indigo-600 block">{t("qr_poster_step3_title", "3. تابع دورك")}</span>
                  <p className="text-[10px] font-semibold text-slate-600 leading-snug">{t("qr_poster_step3_desc", "تلقى تنبيهات حية فور اقتراب نداء دورك")}</p>
                </div>
              </div>

              {/* Footer text */}
              <div className="border-t border-slate-200 pt-3 text-center space-y-0.5">
                <p className="text-xs font-black text-slate-700">{t("qr_poster_footer", "أهلاً وسهلاً بكم • نظام إدارة الطوابير الذكي")}</p>
                <p className="text-[10px] font-mono font-bold text-slate-400">{`${getAppOrigin()}/portal/${shop?.slug || ""}`}</p>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowPosterModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                {t("close", "إغلاق")}
              </button>

              <button
                onClick={downloadPosterImage}
                disabled={isExportingPoster}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-slate-200 font-black text-xs transition-all cursor-pointer flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                <span>{t("qr_download_poster_png", "Download Printable Poster Card (PNG)")}</span>
              </button>

              <button
                onClick={handlePrintPosterNow}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>{t("btn_print_now", "Print Poster Now")}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
