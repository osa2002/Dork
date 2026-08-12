import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { 
  Camera, Upload, Sparkles, Palette, RefreshCw, Check, 
  Scissors, Stethoscope, Coffee, ShoppingBag, Crown, Sparkle, 
  Building2, Car, Smartphone, Utensils, Scale, GraduationCap,
  Eye, Wand2, Loader2, Image as ImageIcon, AlertCircle, X, CheckCircle2,
  FlipHorizontal, Zap
} from "lucide-react";

interface ShopBrandingToolProps {
  editShopName: string;
  editShopLogoText: string;
  editShopCategory: string;
  editShopLogoUrl: string;
  setEditShopLogoUrl: (val: string) => void;
  editShopTicketColor: string;
  setEditShopTicketColor: (val: string) => void;
  dragActive: boolean;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isRtl: boolean;
}

// Preset Icon Definitions
const PRESET_ICONS = [
  {
    id: "barber",
    nameAr: "صالون وحلاقة",
    nameEn: "Barber & Salon",
    bgColor: "#4f46e5",
    iconColor: "#ffffff",
    svgPath: `<path d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6z"/><circle cx="12" cy="12" r="4"/><path d="M12 2v4"/><path d="M12 18v4"/>`
  },
  {
    id: "clinic",
    nameAr: "عيادة وطب",
    nameEn: "Medical & Clinic",
    bgColor: "#0284c7",
    iconColor: "#ffffff",
    svgPath: `<path d="M12 2v20"/><path d="M2 12h20"/><rect x="8" y="8" width="8" height="8" rx="2"/>`
  },
  {
    id: "cafe",
    nameAr: "مقهى ومطعم",
    nameEn: "Café & Food",
    bgColor: "#d97706",
    iconColor: "#ffffff",
    svgPath: `<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>`
  },
  {
    id: "retail",
    nameAr: "متجر وتسوق",
    nameEn: "Retail & Shop",
    bgColor: "#059669",
    iconColor: "#ffffff",
    svgPath: `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`
  },
  {
    id: "vip",
    nameAr: "تاج VIP مميز",
    nameEn: "VIP Crown",
    bgColor: "#7c3aed",
    iconColor: "#ffffff",
    svgPath: `<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>`
  },
  {
    id: "beauty",
    nameAr: "تجميل وعناية",
    nameEn: "Beauty & Spa",
    bgColor: "#ec4899",
    iconColor: "#ffffff",
    svgPath: `<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/>`
  },
  {
    id: "office",
    nameAr: "مكتب وحكومة",
    nameEn: "Office & Gov",
    bgColor: "#475569",
    iconColor: "#ffffff",
    svgPath: `<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/>`
  },
  {
    id: "auto",
    nameAr: "سيارات وصيانة",
    nameEn: "Automotive",
    bgColor: "#dc2626",
    iconColor: "#ffffff",
    svgPath: `<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.2 1 12 1 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>`
  },
  {
    id: "tech",
    nameAr: "تقنية وهواتف",
    nameEn: "Tech & Phones",
    bgColor: "#0891b2",
    iconColor: "#ffffff",
    svgPath: `<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>`
  },
  {
    id: "bakery",
    nameAr: "مخبز وأغذية",
    nameEn: "Bakery & Sweets",
    bgColor: "#ea580c",
    iconColor: "#ffffff",
    svgPath: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`
  },
  {
    id: "law",
    nameAr: "عدالة واستشارات",
    nameEn: "Law & Legal",
    bgColor: "#1e293b",
    iconColor: "#ffffff",
    svgPath: `<path d="m16 16 3-8 3 8a3 3 0 0 1-6 0z"/><path d="m2 16 3-8 3 8a3 3 0 0 1-6 0z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h18"/>`
  },
  {
    id: "education",
    nameAr: "تعليم وتدريب",
    nameEn: "Education",
    bgColor: "#2563eb",
    iconColor: "#ffffff",
    svgPath: `<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>`
  }
];

// Color Swatches
const COLOR_SWATCHES = [
  { hex: "#4f46e5", nameAr: "نيلي ملكي", nameEn: "Royal Indigo" },
  { hex: "#0ea5e9", nameAr: "أزرق سماوي", nameEn: "Ocean Sky" },
  { hex: "#10b981", nameAr: "أخضر زمردي", nameEn: "Emerald Mint" },
  { hex: "#f59e0b", nameAr: "ذهبي دافئ", nameEn: "Amber Gold" },
  { hex: "#f43f5e", nameAr: "وردي قرمزي", nameEn: "Crimson Rose" },
  { hex: "#8b5cf6", nameAr: "بنفسجي فاخر", nameEn: "Luxury Violet" },
  { hex: "#ff6b6b", nameAr: "مرجاني مشرق", nameEn: "Sunset Coral" },
  { hex: "#0f172a", nameAr: "رمادي داكن", nameEn: "Dark Slate" },
  { hex: "#0d9488", nameAr: "تيركواز ساحلي", nameEn: "Coastal Teal" },
  { hex: "#84cc16", nameAr: "ليموني حيوي", nameEn: "Electric Lime" }
];

export const ShopBrandingTool: React.FC<ShopBrandingToolProps> = ({
  editShopName,
  editShopLogoText,
  editShopCategory,
  editShopLogoUrl,
  setEditShopLogoUrl,
  editShopTicketColor,
  setEditShopTicketColor,
  dragActive,
  handleDrag,
  handleDrop,
  handleFileChange,
  isRtl
}) => {
  const { t } = useTranslation();

  // Active Logo Mode: "upload" | "camera" | "presets"
  const [logoMode, setLogoMode] = useState<"upload" | "camera" | "presets">("upload");

  // Camera States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera stream on unmount or tab change
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(
        isRtl
          ? "تعذر الوصول إلى الكاميرا. يرجى التحقق من صلاحيات الأذونات في المتصفح."
          : "Could not access camera. Please check browser permissions."
      );
      setIsCameraActive(false);
    }
  };

  const toggleCameraFacing = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    if (isCameraActive) {
      setTimeout(() => startCamera(), 100);
    }
  };

  // Capture Photo from Camera Canvas
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw centered square crop from video
    const minDim = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - minDim) / 2;
    const startY = (video.videoHeight - minDim) / 2;

    ctx.drawImage(video, startX, startY, minDim, minDim, 0, 0, 400, 400);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    setEditShopLogoUrl(dataUrl);
    stopCamera();
  };

  // Select Preset Icon as SVG Data URI
  const selectPresetIcon = (preset: typeof PRESET_ICONS[0]) => {
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" rx="28" fill="${editShopTicketColor || preset.bgColor}"/><g transform="translate(18, 18) scale(2.6)" stroke="${preset.iconColor}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${preset.svgPath}</g></svg>`;
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
    setEditShopLogoUrl(dataUrl);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm space-y-8">
      {/* Header Title */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>{isRtl ? "هوية المتجر وتخصيص شاشة العرض الرقمية" : "Shop Logo & Digital Queue Customizer"}</span>
              <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-indigo-200/50">
                PRO
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {isRtl 
                ? "تخصيص الشعار بالألوان الحية والالتقاط عبر الكاميرا مع اختيار الأيقونات الجاهزة ورؤية التغييرات فوراً على واجهة العميل." 
                : "Upload or snap a logo, select icon presets, customize primary colors, and preview the live customer view."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Logo & Color Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* SECTION 1: Shop Logo Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                <span>{isRtl ? "1. شعار وشارة المتجر (Shop Logo)" : "1. Shop Logo Image & Icon"}</span>
              </label>

              {editShopLogoUrl && (
                <button
                  type="button"
                  onClick={() => setEditShopLogoUrl("")}
                  className="text-[10px] text-rose-500 hover:text-rose-600 font-extrabold underline cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>{isRtl ? "حذف وإعادة الضبط" : "Remove & Reset"}</span>
                </button>
              )}
            </div>

            {/* Logo Mode Navigation Switcher */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setLogoMode("upload");
                }}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  logoMode === "upload"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isRtl ? "رفع ملف" : "File Upload"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLogoMode("camera");
                  startCamera();
                }}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  logoMode === "camera"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{isRtl ? "الكاميرا المباشرة" : "Camera"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setLogoMode("presets");
                }}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  logoMode === "presets"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Sparkle className="w-3.5 h-3.5" />
                <span>{isRtl ? "أيقونات جاهزة" : "Presets"}</span>
              </button>
            </div>

            {/* TAB CONTENT 1: File Drag & Drop Upload */}
            {logoMode === "upload" && (
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
                  id="logo-file-input-tool"
                  onChange={handleFileChange}
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />

                {editShopLogoUrl ? (
                  <div className="flex items-center justify-center gap-4">
                    <img
                      src={editShopLogoUrl}
                      alt="Brand Logo Preview"
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500/40 shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                    <div className="text-start space-y-1">
                      <p className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>{isRtl ? "تم استخدام الشعار المرفوع بنجاح!" : "Logo uploaded successfully!"}</span>
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {isRtl ? "انقر لاستبدال الصورة أو اختر طريقة أخرى." : "Click to replace or choose another method."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-xs">
                      <span className="font-black text-indigo-600 dark:text-indigo-400">
                        {isRtl ? "انقر لاختيار صورة من جهازك" : "Click to upload logo"}
                      </span>{" "}
                      {isRtl ? "أو قم بسحب وإسقاط الصورة هنا" : "or drag & drop image here"}
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">
                      PNG, JPG, SVG {isRtl ? "بحجم أقصى 1 ميغابايت" : "up to 1MB"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: Live Camera Capture */}
            {logoMode === "camera" && (
              <div className="bg-slate-950 rounded-3xl p-5 border border-slate-800 text-center space-y-4">
                {cameraError ? (
                  <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs font-bold space-y-2">
                    <AlertCircle className="w-6 h-6 mx-auto text-rose-400" />
                    <p>{cameraError}</p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-black cursor-pointer hover:bg-rose-500"
                    >
                      {isRtl ? "إعادة المحاولة" : "Retry Camera"}
                    </button>
                  </div>
                ) : (
                  <div className="relative max-w-xs mx-auto overflow-hidden rounded-3xl border-2 border-indigo-500/50 shadow-xl bg-black">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-56 object-cover transform scale-x-[-1]"
                    />
                    {/* Round Overlay Frame */}
                    <div className="absolute inset-0 border-4 border-indigo-500/60 rounded-full m-4 pointer-events-none flex items-center justify-center">
                      <span className="text-[9px] font-black text-white bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-sm">
                        {isRtl ? "ضع الشعار داخل الدائرة" : "Center Logo inside circle"}
                      </span>
                    </div>

                    {/* Camera Control Buttons Bar */}
                    <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={toggleCameraFacing}
                        className="p-2.5 rounded-full bg-slate-900/80 text-white hover:bg-slate-800 backdrop-blur-sm cursor-pointer border border-slate-700"
                        title={isRtl ? "تبديل الكاميرا" : "Flip Camera"}
                      >
                        <FlipHorizontal className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black text-xs cursor-pointer hover:from-indigo-500 hover:to-violet-500 shadow-lg flex items-center gap-1.5"
                      >
                        <Camera className="w-4 h-4" />
                        <span>{isRtl ? "التقاط الشعار الان" : "Snap Logo Photo"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={stopCamera}
                        className="p-2.5 rounded-full bg-rose-950/80 text-rose-300 hover:bg-rose-900 backdrop-blur-sm cursor-pointer border border-rose-800/60"
                        title={isRtl ? "إغلاق الكاميرا" : "Close Camera"}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 3: Default Preset Icons */}
            {logoMode === "presets" && (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {isRtl 
                    ? "اختر أيقونة جاهزة عالية الدقة لمتجرك مع خلفية لون الماركة المحدد:"
                    : "Select a crisp high-res preset vector badge matching your brand:"}
                </p>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1 custom-scrollbar">
                  {PRESET_ICONS.map((preset) => {
                    const isSelected = editShopLogoUrl.includes(preset.id);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => selectPresetIcon(preset)}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2 group relative overflow-hidden ${
                          isSelected
                            ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500/50"
                            : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105"
                          style={{ backgroundColor: editShopTicketColor || preset.bgColor }}
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: preset.svgPath }} />
                        </div>
                        <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 truncate w-full">
                          {isRtl ? preset.nameAr : preset.nameEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Primary Theme Colors & Swatches */}
          <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-6">
            <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>{isRtl ? "2. لون الهوية الأساسي لشباك الانتظار" : "2. Customer View Primary Color"}</span>
              </div>
              <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400">
                {editShopTicketColor}
              </span>
            </label>

            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="color"
                  value={editShopTicketColor}
                  onChange={(e) => setEditShopTicketColor(e.target.value)}
                  className="w-14 h-12 p-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer shadow-sm"
                />
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 flex-1">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => setEditShopTicketColor(swatch.hex)}
                    title={`${isRtl ? swatch.nameAr : swatch.nameEn} (${swatch.hex})`}
                    className={`h-11 rounded-xl transition-all cursor-pointer relative flex items-center justify-center border-2 ${
                      editShopTicketColor.toLowerCase() === swatch.hex.toLowerCase()
                        ? "border-white dark:border-slate-900 scale-110 shadow-md ring-2 ring-indigo-500"
                        : "border-transparent hover:scale-105 opacity-90 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  >
                    {editShopTicketColor.toLowerCase() === swatch.hex.toLowerCase() && (
                      <Check className="w-4 h-4 text-white drop-shadow-md" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Customer View Preview Box (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950 p-6 rounded-3xl border border-slate-800 text-white space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-xs font-black flex items-center gap-2 text-indigo-400">
              <Eye className="w-4 h-4" />
              <span>{isRtl ? "معاينة حية لشاشة شباك الانتظار الرقمية" : "Live Customer Phone Preview"}</span>
            </h4>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>

          {/* Smartphone Frame Container */}
          <div className="bg-slate-900 rounded-3xl p-4 border border-slate-800 shadow-inner space-y-4 relative overflow-hidden">
            {/* Top Notch & Time Header */}
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono px-1">
              <span>9:41 AM</span>
              <div className="w-12 h-3 bg-slate-800 rounded-full" />
              <span>100% 🔋</span>
            </div>

            {/* Simulated Customer Header */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-2.5">
                {editShopLogoUrl ? (
                  <img
                    src={editShopLogoUrl}
                    alt="Logo"
                    className="w-9 h-9 rounded-xl object-cover border border-slate-700 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold text-xs"
                    style={{ backgroundColor: editShopTicketColor || "#4f46e5" }}
                  >
                    {editShopName ? editShopName.charAt(0).toUpperCase() : "D"}
                  </div>
                )}
                <div>
                  <h5 className="text-xs font-black text-white leading-none">
                    {editShopName || (isRtl ? "اسم متجرك هنا" : "Your Shop Name")}
                  </h5>
                  <span
                    className="text-[9px] font-bold mt-1 block"
                    style={{ color: editShopTicketColor || "#818cf8" }}
                  >
                    {editShopCategory || (isRtl ? "الفئة المختارة" : "Category")}
                  </span>
                </div>
              </div>

              <span className="text-[9px] font-black px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {isRtl ? "مفتوح الآن" : "OPEN"}
              </span>
            </div>

            {/* Simulated Active Ticket Card */}
            <div
              className="p-5 rounded-2xl border text-center space-y-3 relative overflow-hidden shadow-lg transition-all"
              style={{
                backgroundColor: `${editShopTicketColor}15` || "rgba(79, 70, 229, 0.15)",
                borderColor: `${editShopTicketColor}40` || "rgba(79, 70, 229, 0.4)"
              }}
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 block">
                {isRtl ? "رقم تذكرتك الرقمية" : "YOUR DIGITAL TICKET"}
              </span>

              <div
                className="text-4xl font-black font-mono tracking-wider drop-shadow-md py-1"
                style={{ color: editShopTicketColor || "#ffffff" }}
              >
                A-042
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span>{isRtl ? "دورك القادم خلال 5 دقائق" : "Your turn in ~5 mins"}</span>
              </div>

              {/* Progress Bar styled with ticketColor */}
              <div className="w-full bg-slate-950/60 rounded-full h-2 overflow-hidden border border-slate-800 mt-2">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: "75%",
                    backgroundColor: editShopTicketColor || "#4f46e5"
                  }}
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-400 text-center font-medium leading-relaxed px-2">
              {isRtl
                ? "هكذا تظهر شاشة التذكرة والانتظار الرقمية للعملاء بعد مسح رمز QR من جوالاتهم."
                : "This is how the customer digital queue ticket card renders live on phones."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
