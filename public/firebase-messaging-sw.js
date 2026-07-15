// Firebase Messaging Service Worker to handle background push notifications
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBjr_JGTN07kf91jk2fkNfbn7W8Eb8L8mA",
  authDomain: "tokyo-entry-3n56p.firebaseapp.com",
  projectId: "tokyo-entry-3n56p",
  storageBucket: "tokyo-entry-3n56p.firebasestorage.app",
  messagingSenderId: "879344400953",
  appId: "1:879344400953:web:f21e3e6f5723d50fe42be8"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'تنبيه من دورك! 🔔';
  const notificationOptions = {
    body: payload.notification?.body || 'تحديث جديد بخصوص تذكرتك في الانتظار.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
