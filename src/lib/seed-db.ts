import { initializeApp } from "firebase/app";
import { getFirestore, doc, writeBatch, collection, getDocs, deleteDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";

// Load configuration
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
if (!fs.existsSync(configPath)) {
  console.error("❌ Error: firebase-applet-config.json not found!");
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

console.log("🚀 Initializing Firebase for Seeding...");
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function seed() {
  console.log("🧹 Cleaning up old pre-seeded data for salon, clinic, and gov center...");
  const collectionsToClean = ["shops", "services", "tickets", "displays"];
  
  // Clean up specific shop documents
  const demoShopIds = ["demo_user_salon", "demo_user_clinic", "demo_user_gov"];
  for (const id of demoShopIds) {
    try {
      await deleteDoc(doc(db, "shops", id));
      await deleteDoc(doc(db, "displays", `display_${id}`));
    } catch (e) {
      console.log(`Note: old shop doc clean-up skipped for ${id}`);
    }
  }

  // Clean up existing services and tickets related to these shops
  for (const coll of ["services", "tickets"]) {
    try {
      const qSnap = await getDocs(collection(db, coll));
      const batch = writeBatch(db);
      let count = 0;
      qSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (demoShopIds.includes(data.shopId)) {
          batch.delete(docSnap.ref);
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
        console.log(`🗑️ Deleted ${count} old ${coll} documents`);
      }
    } catch (err) {
      console.log(`Note: cleanup of ${coll} skipped or failed.`);
    }
  }

  console.log("🌱 Database cleaned! Preparing new seed data...");

  const batch = writeBatch(db);
  const now = new Date();
  
  // Helpers to get ISO dates relative to now (for historical charts and analytics)
  const hoursAgo = (h: number) => {
    const d = new Date(now);
    d.setHours(d.getHours() - h);
    return d.toISOString();
  };
  
  const daysAgo = (days: number, hours: number = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    d.setHours(d.getHours() - hours);
    return d.toISOString();
  };

  // ==========================================
  // SHOP 1: صالون الأناقة العصري (Modern Barber)
  // ==========================================
  const shop1Id = "demo_user_salon";
  batch.set(doc(db, "shops", shop1Id), {
    id: shop1Id,
    ownerId: shop1Id,
    name: "صالون الأناقة العصري",
    slug: "modern-salon",
    category: "حلاق", // Barber
    logoUrl: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    ticketColor: "#4f46e5", // Indigo
    workingHours: {
      open: "09:00",
      close: "22:00",
      days: [1, 2, 3, 4, 6, 7] // Sat - Thu
    },
    plan: "pro",
    planExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: daysAgo(10)
  });

  // Services for Salon
  const salonServices = [
    { id: "salon_s1", shopId: shop1Id, name: "حلاقة وتصفيف شعر (Haircut)", avgDurationMinutes: 20, isActive: true, createdAt: daysAgo(10) },
    { id: "salon_s2", shopId: shop1Id, name: "تشذيب وتحديد لحية (Beard)", avgDurationMinutes: 15, isActive: true, createdAt: daysAgo(10) },
    { id: "salon_s3", shopId: shop1Id, name: "جلسة عناية ملكية متكاملة (Elite Care)", avgDurationMinutes: 45, isActive: true, createdAt: daysAgo(10) }
  ];
  salonServices.forEach(s => batch.set(doc(db, "services", s.id), s));

  // Tickets for Salon (Realistic queue state: some completed with ratings, some waiting, one calling)
  const salonTickets = [
    // Past completed tickets with feedback (for analytics)
    {
      id: "salon_t1", shopId: shop1Id, serviceId: "salon_s1", serviceName: "حلاقة وتصفيف شعر (Haircut)",
      customerName: "أحمد العتيبي", customerPhone: "0501234567", ticketNumber: 1, status: "completed",
      createdAt: hoursAgo(4), calledAt: hoursAgo(3.7), completedAt: hoursAgo(3.4),
      rating: 5, ratingComment: "حلاقة ممتازة ومعاملة راقية جداً، شكراً لكم!", ratedAt: hoursAgo(3.3)
    },
    {
      id: "salon_t2", shopId: shop1Id, serviceId: "salon_s2", serviceName: "تشذيب وتحديد لحية (Beard)",
      customerName: "خالد الحربي", customerPhone: "0559876543", ticketNumber: 2, status: "completed",
      createdAt: hoursAgo(3), calledAt: hoursAgo(2.8), completedAt: hoursAgo(2.6),
      rating: 4, ratingComment: "شغل ممتاز ودقيق جداً، ولكن كان هناك وقت انتظار بسيط.", ratedAt: hoursAgo(2.5)
    },
    {
      id: "salon_t3", shopId: shop1Id, serviceId: "salon_s1", serviceName: "حلاقة وتصفيف شعر (Haircut)",
      customerName: "عبدالله الشمري", customerPhone: "0564443322", ticketNumber: 3, status: "completed",
      createdAt: hoursAgo(2), calledAt: hoursAgo(1.8), completedAt: hoursAgo(1.5),
      rating: 5, ratingComment: "أفضل صالون حلاقة تعاملت معه في المدينة، شغل احترافي.", ratedAt: hoursAgo(1.4)
    },
    {
      id: "salon_t4", shopId: shop1Id, serviceId: "salon_s3", serviceName: "جلسة عناية ملكية متكاملة (Elite Care)",
      customerName: "سلطان المطيري", customerPhone: "0543322110", ticketNumber: 4, status: "no_show",
      createdAt: hoursAgo(1.5), calledAt: hoursAgo(1.2), completedAt: hoursAgo(1.0)
    },
    // Ticket being called right now
    {
      id: "salon_t5", shopId: shop1Id, serviceId: "salon_s1", serviceName: "حلاقة وتصفيف شعر (Haircut)",
      customerName: "فيصل القحطاني", customerPhone: "0590001112", ticketNumber: 5, status: "calling",
      createdAt: hoursAgo(0.5), calledAt: hoursAgo(0.1)
    },
    // Tickets waiting in queue
    {
      id: "salon_t6", shopId: shop1Id, serviceId: "salon_s2", serviceName: "تشذيب وتحديد لحية (Beard)",
      customerName: "فهد الدوسري", customerPhone: "0533344556", ticketNumber: 6, status: "waiting",
      createdAt: hoursAgo(0.3)
    },
    {
      id: "salon_t7", shopId: shop1Id, serviceId: "salon_s3", serviceName: "جلسة عناية ملكية متكاملة (Elite Care)",
      customerName: "يوسف المالكي", customerPhone: "0565566778", ticketNumber: 7, status: "waiting",
      createdAt: hoursAgo(0.1)
    }
  ];
  salonTickets.forEach(t => batch.set(doc(db, "tickets", t.id), t));

  // Public Display config for Salon
  batch.set(doc(db, "displays", `display_${shop1Id}`), {
    id: `display_${shop1Id}`,
    shopId: shop1Id,
    name: "الشاشة الرئيسية للمحل",
    lastActive: now.toISOString(),
    createdAt: daysAgo(5)
  });


  // ==========================================
  // SHOP 2: عيادة الشفاء الطبية (Al-Shifa Clinic)
  // ==========================================
  const shop2Id = "demo_user_clinic";
  batch.set(doc(db, "shops", shop2Id), {
    id: shop2Id,
    ownerId: shop2Id,
    name: "عيادة الشفاء الطبية المتقدمة",
    slug: "shifa-clinic",
    category: "عيادة", // Clinic
    logoUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    ticketColor: "#0d9488", // Teal
    workingHours: {
      open: "08:30",
      close: "21:00",
      days: [1, 2, 3, 4, 5, 6] // Sat - Thu
    },
    plan: "pro",
    planExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: daysAgo(15)
  });

  // Services for Clinic
  const clinicServices = [
    { id: "clinic_s1", shopId: shop2Id, name: "عيادة الباطنية والطب العام (General)", avgDurationMinutes: 15, isActive: true, createdAt: daysAgo(15) },
    { id: "clinic_s2", shopId: shop2Id, name: "عيادة الأطفال والرضع (Pediatrics)", avgDurationMinutes: 20, isActive: true, createdAt: daysAgo(15) },
    { id: "clinic_s3", shopId: shop2Id, name: "عيادة طب وجراحة الأسنان (Dentistry)", avgDurationMinutes: 30, isActive: true, createdAt: daysAgo(15) }
  ];
  clinicServices.forEach(s => batch.set(doc(db, "services", s.id), s));

  // Tickets for Clinic
  const clinicTickets = [
    {
      id: "clinic_t1", shopId: shop2Id, serviceId: "clinic_s1", serviceName: "عيادة الباطنية والطب العام (General)",
      customerName: "عبدالرحمن البقمي", customerPhone: "0502221111", ticketNumber: 101, status: "completed",
      createdAt: hoursAgo(5), calledAt: hoursAgo(4.8), completedAt: hoursAgo(4.5),
      rating: 5, ratingComment: "طبيب ممتاز ومتفهم جداً والتشخيص دقيق.", ratedAt: hoursAgo(4.4)
    },
    {
      id: "clinic_t2", shopId: shop2Id, serviceId: "clinic_s2", serviceName: "عيادة الأطفال والرضع (Pediatrics)",
      customerName: "سليمان الفوزان", customerPhone: "0563332222", ticketNumber: 102, status: "completed",
      createdAt: hoursAgo(4), calledAt: hoursAgo(3.7), completedAt: hoursAgo(3.3),
      rating: 5, ratingComment: "عيادة نظيفة ومنظمة جداً، ممتازين للأطفال.", ratedAt: hoursAgo(3.2)
    },
    {
      id: "clinic_t3", shopId: shop2Id, serviceId: "clinic_s3", serviceName: "عيادة طب وجراحة الأسنان (Dentistry)",
      customerName: "تركي الرشيد", customerPhone: "0544445555", ticketNumber: 103, status: "completed",
      createdAt: hoursAgo(3), calledAt: hoursAgo(2.5), completedAt: hoursAgo(2.0),
      rating: 3, ratingComment: "العلاج ممتاز ولكن تأخرت جداً في الانتظار لعدم الالتزام بالوقت المجدد.", ratedAt: hoursAgo(1.9)
    },
    {
      id: "clinic_t4", shopId: shop2Id, serviceId: "clinic_s1", serviceName: "عيادة الباطنية والطب العام (General)",
      customerName: "محمد الهاشمي", customerPhone: "0533331111", ticketNumber: 104, status: "calling",
      createdAt: hoursAgo(1.2), calledAt: hoursAgo(0.2)
    },
    {
      id: "clinic_t5", shopId: shop2Id, serviceId: "clinic_s1", serviceName: "عيادة الباطنية والطب العام (General)",
      customerName: "نايف العريفي", customerPhone: "0555556666", ticketNumber: 105, status: "waiting",
      createdAt: hoursAgo(0.8)
    },
    {
      id: "clinic_t6", shopId: shop2Id, serviceId: "clinic_s2", serviceName: "عيادة الأطفال والرضع (Pediatrics)",
      customerName: "باسل السديري", customerPhone: "0566667777", ticketNumber: 106, status: "waiting",
      createdAt: hoursAgo(0.4)
    }
  ];
  clinicTickets.forEach(t => batch.set(doc(db, "tickets", t.id), t));

  // Public Display for Clinic
  batch.set(doc(db, "displays", `display_${shop2Id}`), {
    id: `display_${shop2Id}`,
    shopId: shop2Id,
    name: "شاشة صالة الاستقبال الكبرى",
    lastActive: now.toISOString(),
    createdAt: daysAgo(7)
  });


  // ==========================================
  // SHOP 3: مركز الخدمة الحكومي الموحد (Gov Center)
  // ==========================================
  const shop3Id = "demo_user_gov";
  batch.set(doc(db, "shops", shop3Id), {
    id: shop3Id,
    ownerId: shop3Id,
    name: "مركز الخدمات الموحد - الدائرة الثالثة",
    slug: "gov-center",
    category: "حكومي", // Government Center
    logoUrl: "https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    ticketColor: "#0f172a", // Slate 900
    workingHours: {
      open: "08:00",
      close: "15:00",
      days: [1, 2, 3, 4, 5] // Sun - Thu
    },
    plan: "pro",
    planExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: daysAgo(30)
  });

  // Services for Gov Center
  const govServices = [
    { id: "gov_s1", shopId: shop3Id, name: "تجديد الهوية الوطنية والوثائق (ID Renewal)", avgDurationMinutes: 15, isActive: true, createdAt: daysAgo(30) },
    { id: "gov_s2", shopId: shop3Id, name: "معاملات الأحوال المدنية (Civil Registry)", avgDurationMinutes: 20, isActive: true, createdAt: daysAgo(30) },
    { id: "gov_s3", shopId: shop3Id, name: "إصدار وتجديد الرخص والأنشطة (Commercial)", avgDurationMinutes: 25, isActive: true, createdAt: daysAgo(30) }
  ];
  govServices.forEach(s => batch.set(doc(db, "services", s.id), s));

  // Tickets for Gov Center
  const govTickets = [
    {
      id: "gov_t1", shopId: shop3Id, serviceId: "gov_s1", serviceName: "تجديد الهوية الوطنية والوثائق (ID Renewal)",
      customerName: "سليمان العيسى", customerPhone: "0543322119", ticketNumber: 201, status: "completed",
      createdAt: hoursAgo(4), calledAt: hoursAgo(3.8), completedAt: hoursAgo(3.5),
      rating: 5, ratingComment: "إجراءات سريعة وميسرة جداً والموظف خلوق.", ratedAt: hoursAgo(3.4)
    },
    {
      id: "gov_t2", shopId: shop3Id, serviceId: "gov_s2", serviceName: "معاملات الأحوال المدنية (Civil Registry)",
      customerName: "منصور الشريف", customerPhone: "0505554443", ticketNumber: 202, status: "completed",
      createdAt: hoursAgo(3.2), calledAt: hoursAgo(3.0), completedAt: hoursAgo(2.7),
      rating: 4, ratingComment: "ممتاز وسلس جداً.", ratedAt: hoursAgo(2.6)
    },
    {
      id: "gov_t3", shopId: shop3Id, serviceId: "gov_s3", serviceName: "إصدار وتجديد الرخص والأنشطة (Commercial)",
      customerName: "سعد السبيعي", customerPhone: "0590098877", ticketNumber: 203, status: "calling",
      createdAt: hoursAgo(1.5), calledAt: hoursAgo(0.3)
    },
    {
      id: "gov_t4", shopId: shop3Id, serviceId: "gov_s1", serviceName: "تجديد الهوية الوطنية والوثائق (ID Renewal)",
      customerName: "طلال الحربي", customerPhone: "0533321122", ticketNumber: 204, status: "waiting",
      createdAt: hoursAgo(0.5)
    }
  ];
  govTickets.forEach(t => batch.set(doc(db, "tickets", t.id), t));

  // Public Display for Gov Center
  batch.set(doc(db, "displays", `display_${shop3Id}`), {
    id: `display_${shop3Id}`,
    shopId: shop3Id,
    name: "شاشة الانتظار رقم 1 - يمين الصالة",
    lastActive: now.toISOString(),
    createdAt: daysAgo(12)
  });

  // Seed mock Billing Invoices (upgrade logs)
  const invoice1Id = `inv_${shop1Id}_1`;
  batch.set(doc(db, "shops", shop1Id, "invoices", invoice1Id), {
    id: invoice1Id,
    shopId: shop1Id,
    invoiceNumber: "INV-2026-00342",
    amount: "29.00 USD",
    planName: "PRO PLAN",
    status: "paid",
    cardBrand: "Visa",
    cardLast4: "4242",
    createdAt: daysAgo(8)
  });

  const invoice2Id = `inv_${shop2Id}_1`;
  batch.set(doc(db, "shops", shop2Id, "invoices", invoice2Id), {
    id: invoice2Id,
    shopId: shop2Id,
    invoiceNumber: "INV-2026-00411",
    amount: "99.00 USD",
    planName: "ENTERPRISE",
    status: "paid",
    cardBrand: "Mastercard",
    cardLast4: "8821",
    createdAt: daysAgo(12)
  });

  console.log("📝 Writing seed data to Firestore (batch commit)...");
  await batch.commit();

  console.log("✅ SEED SUCCESSFUL! Firestore has been successfully pre-populated with highly realistic mock data for Barber, Clinic, and Gov Center.");
  console.log("👉 Slugs created:");
  console.log("   - Barber (حلاق):  `modern-salon` (Owner: `demo_user_salon`)");
  console.log("   - Clinic (عيادة):  `shifa-clinic` (Owner: `demo_user_clinic`)");
  console.log("   - Gov (حكومي):    `gov-center`   (Owner: `demo_user_gov`)");
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Seeding failed with error:", err);
    process.exit(1);
  });
