import 'package:flutter/material.dart';

/// Supported Locales for Dork Customer Mobile V1
class AppLocalizations {
  static const List<Locale> supportedLocales = [
    Locale('ar'), // Arabic - RTL
    Locale('en'), // English - LTR
    Locale('tr'), // Turkish - LTR
  ];

  static bool isRtl(Locale locale) {
    return locale.languageCode == 'ar';
  }

  static const Map<String, Map<String, String>> _localizedValues = {
    'en': {
      'appTitle': 'Dork Customer Mobile',
      'welcome': 'Welcome to Dork Queue Management',
      'scanQr': 'Scan QR Code',
      'activeTicket': 'Active Ticket',
      'ticketHistory': 'Ticket History',
      'cancelTicket': 'Cancel Ticket',
      'queuePosition': 'Your Position',
      'estimatedWait': 'Estimated Wait',
      'mins': 'mins',
    },
    'ar': {
      'appTitle': 'دورك للعملاء',
      'welcome': 'أهلاً بك في نظام إدارة الدور',
      'scanQr': 'مسح رمز الاستجابة السريعة',
      'activeTicket': 'التذكرة النشطة',
      'ticketHistory': 'سجل التذاكر',
      'cancelTicket': 'إلغاء التذكرة',
      'queuePosition': 'ترتيبك في الدور',
      'estimatedWait': 'الانتظار المتوقع',
      'mins': 'دقيقة',
    },
    'tr': {
      'appTitle': 'Dork Müşteri Mobil',
      'welcome': 'Sıra Yönetim Sistemine Hoş Geldiniz',
      'scanQr': 'Karekod Tara',
      'activeTicket': 'Aktif Bilet',
      'ticketHistory': 'Bilet Geçmişi',
      'cancelTicket': 'Bileti İptal Et',
      'queuePosition': 'Sıranız',
      'estimatedWait': 'Tahmini Bekleme',
      'mins': 'dk',
    },
  };

  static String getString(BuildContext context, String key) {
    final locale = Localizations.localeOf(context);
    final langCode = locale.languageCode;
    return _localizedValues[langCode]?[key] ?? _localizedValues['en']?[key] ?? key;
  }
}
