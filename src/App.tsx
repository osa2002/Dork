import React, { useState, useEffect, lazy, Suspense } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import { ClientLogger } from "./lib/clientLogger";
import LandingPage from "./components/LandingPage";
import { Loader2, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "./store";

const AuthScreen = lazy(() => import("./components/AuthScreen"));
const CustomerPortal = lazy(() => import("./components/CustomerPortal"));
const PublicDisplay = lazy(() => import("./components/PublicDisplay"));
const VendorDashboard = lazy(() => import("./components/VendorDashboard"));
const StripeMockCheckout = lazy(() => import("./components/StripeMockCheckout"));
const AdminRouter = lazy(() => import("./admin/routes/AdminRouter").then((m) => ({ default: m.AdminRouter })));

export default function App() {
  const { t } = useTranslation();
  const isDarkMode = useUiStore((state) => state.isDarkMode);
  const setIsDarkMode = useUiStore((state) => state.setIsDarkMode);

  // Navigation State
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<string | null>(null);

  // Auth State
  const [user, setUser] = useState<any>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Parse URL query params on mount and when back/forward occurs
  const parseUrl = () => {
    const pathname = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    let slug = params.get("shop");
    let page = params.get("page");

    // Support clean URL routing with safe decoding of URL segments (e.g. for Arabic/Turkish characters)
    const getDecodedPart = (part: string | undefined): string | null => {
      if (!part) return null;
      try {
        return decodeURIComponent(part);
      } catch (e) {
        console.warn("Failed to decode URL segment:", part, e);
        return part;
      }
    };

    if (pathname.startsWith("/portal/")) {
      const parts = pathname.split("/");
      if (parts[2]) {
        slug = getDecodedPart(parts[2]);
        page = null;
      }
    } else if (pathname.startsWith("/display/")) {
      const parts = pathname.split("/");
      if (parts[2]) {
        slug = getDecodedPart(parts[2]);
        page = "display";
      }
    } else if (pathname.startsWith("/display-setup/")) {
      const parts = pathname.split("/");
      if (parts[2]) {
        slug = getDecodedPart(parts[2]);
        page = "display";
      }
    } else if (pathname === "/stripe-mock-checkout" || pathname.startsWith("/stripe-mock-checkout")) {
      page = "stripe-mock-checkout";
    } else if (pathname === "/admin" || pathname.startsWith("/admin")) {
      page = "admin";
    } else if (pathname === "/dashboard" || pathname.startsWith("/dashboard")) {
      page = "dashboard";
    }

    setCurrentSlug(slug);
    setCurrentPage(page);
  };

  useEffect(() => {
    parseUrl();
    window.addEventListener("popstate", parseUrl);
    return () => window.removeEventListener("popstate", parseUrl);
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const localUserJson = localStorage.getItem("dorkq_local_user");
    if (localUserJson) {
      try {
        const localUser = JSON.parse(localUserJson);
        setUser(localUser);
        setShopId(localUser.uid);
        setAuthLoading(false);
        return;
      } catch (e) {
        console.error("Error reading local user:", e);
      }
    }

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      // If a local session was created in the meantime, ignore auth change
      if (localStorage.getItem("dorkq_local_user")) return;

      setUser(currentUser);
      
      if (currentUser) {
        ClientLogger.info("Firebase auth state changed: User authenticated", { uid: currentUser.uid, email: currentUser.email });
        // Find the shop owned by this user
        try {
          const shopsRef = collection(db, "shops");
          const q = query(shopsRef, where("ownerId", "==", currentUser.uid));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const foundShopId = querySnapshot.docs[0].id;
            setShopId(foundShopId);
            ClientLogger.info("Vendor shop located successfully", { shopId: foundShopId });
          } else {
            // An anonymous user/demo user might have their shopId set as their UID
            setShopId(currentUser.uid);
            ClientLogger.info("No explicit shop doc found, setting shopId to UID", { shopId: currentUser.uid });
          }
        } catch (err) {
          ClientLogger.error("Error fetching vendor shop doc:", err);
          console.error("Error fetching vendor shop:", err);
          setShopId(currentUser.uid);
        }
      } else {
        ClientLogger.info("Firebase auth state changed: Unauthenticated user");
        setShopId(null);
      }
      setAuthLoading(false);
    }, (authError) => {
      ClientLogger.error("Firebase auth state listener error:", authError);
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  // Navigation handlers
  const navigateTo = (page: string | null, slug: string | null = null) => {
    let url = "/";
    if (page === "display" && slug) {
      url = `/display/${encodeURIComponent(slug)}`;
    } else if (page === "dashboard") {
      url = "/dashboard";
    } else if (page === "stripe-mock-checkout") {
      url = "/stripe-mock-checkout";
    } else if (slug) {
      url = `/portal/${encodeURIComponent(slug)}`;
    } else if (page) {
      url = `?page=${page}`;
    }
    
    window.history.pushState({}, "", url);
    setCurrentPage(page);
    setCurrentSlug(slug);
  };

  const handleStartVendorFlow = () => {
    navigateTo("dashboard");
  };

  const handleAuthSuccess = (vendorShopId: string) => {
    const localUserJson = localStorage.getItem("dorkq_local_user");
    if (localUserJson) {
      try {
        const localUser = JSON.parse(localUserJson);
        setUser(localUser);
      } catch (e) {
        console.error(e);
      }
    } else if (auth.currentUser) {
      setUser(auth.currentUser);
    }
    setShopId(vendorShopId);
    navigateTo("dashboard");
  };

  const handleSignOut = () => {
    localStorage.removeItem("dorkq_local_user");
    setUser(null);
    setShopId(null);
    navigateTo(null);
  };

  const handleBackToHome = () => {
    navigateTo(null);
  };

  // Auth/Initializing loading spinner
  if (authLoading) {
    return (
      <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"} flex flex-col items-center justify-center p-6 text-center`}>
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <h3 className="text-lg font-bold text-slate-800">{t("loading")}</h3>
        <p className="text-slate-500 text-xs mt-1">{t("loading_subtitle")}</p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"} flex flex-col items-center justify-center p-6 text-center`}>
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t("loading")}</h3>
          <p className="text-slate-500 text-xs mt-1">{t("loading_subtitle")}</p>
        </div>
      }
    >
      {(() => {
        // 1. Public Display Screen (Wall-mounted Monitor / TV)
        if (currentPage === "display" && currentSlug) {
          return (
            <PublicDisplay
              shopSlug={currentSlug}
              onBackToHome={handleBackToHome}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
            />
          );
        }

        // 2. Customer Digital Ticket Portal (via QR scanner)
        if (currentSlug) {
          return (
            <CustomerPortal 
              shopSlug={currentSlug} 
              onBackToHome={handleBackToHome} 
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
            />
          );
        }

        // 1.7. Stripe Mock Checkout Page
        if (currentPage === "stripe-mock-checkout") {
          const params = new URLSearchParams(window.location.search);
          const mockSessionId = params.get("sessionId") || "mock_session_id";
          const mockShopId = params.get("shopId") || "";
          const mockLang = params.get("lang") || "en";

          return (
            <StripeMockCheckout
              sessionId={mockSessionId}
              shopId={mockShopId}
              lang={mockLang}
              isDarkMode={isDarkMode}
              onCancel={handleBackToHome}
            />
          );
        }

        // 1.8. Enterprise Platform Admin UI
        if (currentPage === "admin") {
          return <AdminRouter onBackToHome={handleBackToHome} />;
        }

        // 2. Vendor Dashboard / Auth screen
        if (currentPage === "dashboard") {
          if (user && shopId) {
            return (
              <VendorDashboard 
                shopId={shopId} 
                onSignOut={handleSignOut} 
                isDarkMode={isDarkMode}
                setIsDarkMode={setIsDarkMode}
              />
            );
          } else {
            return (
              <AuthScreen 
                onAuthSuccess={handleAuthSuccess} 
                onBackToHome={handleBackToHome} 
                isDarkMode={isDarkMode}
                setIsDarkMode={setIsDarkMode}
              />
            );
          }
        }

        // 3. Main Landing Page
        return (
          <LandingPage 
            onStart={handleStartVendorFlow} 
            onGoToDashboard={handleStartVendorFlow} 
            userLoggedIn={!!user && !!shopId} 
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            onJoinShop={(slug) => navigateTo(null, slug)}
            onOpenAdmin={() => navigateTo("admin")}
          />
        );
      })()}
    </Suspense>
  );
}
