import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform, kIsWeb;

/// Firebase Options configured from verified firebase-applet-config.json
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        return web;
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyBjr_JGTN07kf91jk2fkNfbn7W8Eb8L8mA',
    appId: '1:879344400953:web:f21e3e6f5723d50fe42be8',
    messagingSenderId: '879344400953',
    projectId: 'tokyo-entry-3n56p',
    authDomain: 'tokyo-entry-3n56p.firebaseapp.com',
    storageBucket: 'tokyo-entry-3n56p.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyBjr_JGTN07kf91jk2fkNfbn7W8Eb8L8mA',
    appId: '1:879344400953:android:f21e3e6f5723d50fe42be8',
    messagingSenderId: '879344400953',
    projectId: 'tokyo-entry-3n56p',
    authDomain: 'tokyo-entry-3n56p.firebaseapp.com',
    storageBucket: 'tokyo-entry-3n56p.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyBjr_JGTN07kf91jk2fkNfbn7W8Eb8L8mA',
    appId: '1:879344400953:ios:f21e3e6f5723d50fe42be8',
    messagingSenderId: '879344400953',
    projectId: 'tokyo-entry-3n56p',
    authDomain: 'tokyo-entry-3n56p.firebaseapp.com',
    storageBucket: 'tokyo-entry-3n56p.firebasestorage.app',
  );
}
