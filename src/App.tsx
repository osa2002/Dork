import React, { useState, useEffect, lazy, Suspense } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import LandingPage from "./components/LandingPage";
import AuthScreen from "./components/AuthScreen";
import CustomerPortal from "./components/CustomerPortal";
import PublicDisplay from "./components/PublicDisplay";
import { Loader2, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

const VendorDashboard = lazy(() => import("./components/VendorDashboard"));
const StripeMockCheckout = lazy(() => import("./components/StripeMockCheckout"));

export default function App() {
  const { t } = useTranslation();

  // Global Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("dork_global_dark_mode") === "true";
  });

  useEffect(() => {
    localStorage.setItem("dork_global_dark_mode", String(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Navigation State
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<string | null>(null);

  // Auth State
  const [user, setUser] = useState<any>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Parse URL query params on mount and when back/forward occurs
  const parseUrl = () => {
    const params = new URLSearchParams(window.location.search);
    setCurrentSlug(params.get("shop"));
    setCurrentPage(params.get("page"));
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
        // Find the shop owned by this user
        try {
          const shopsRef = collection(db, "shops");
          const q = query(shopsRef, where("ownerId", "==", currentUser.uid));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            setShopId(querySnapshot.docs[0].id);
          } else {
            // An anonymous user/demo user might have their shopId set as their UID
            setShopId(currentUser.uid);
          }
        } catch (err) {
          console.error("Error fetching vendor shop:", err);
        }
      } else {
        setShopId(null);
      }
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  // Navigation handlers
  const navigateTo = (page: string | null, slug: string | null = null) => {
    let url = "/";
    if (page) {
      url = `?page=${page}`;
    } else if (slug) {
      url = `?shop=${slug}`;
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
      <Suspense
        fallback={
          <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"} flex flex-col items-center justify-center p-6 text-center`}>
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t("loading")}</h3>
          </div>
        }
      >
        <StripeMockCheckout
          sessionId={mockSessionId}
          shopId={mockShopId}
          lang={mockLang}
          isDarkMode={isDarkMode}
          onCancel={handleBackToHome}
        />
      </Suspense>
    );
  }

  // 2. Vendor Dashboard / Auth screen
  if (currentPage === "dashboard") {
    if (user && shopId) {
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
          <VendorDashboard 
            shopId={shopId} 
            onSignOut={handleSignOut} 
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
          />
        </Suspense>
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
    />
  );
}
