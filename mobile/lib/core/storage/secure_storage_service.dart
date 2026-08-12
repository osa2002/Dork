import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Secure Storage service wrapper
class SecureStorageService {
  final FlutterSecureStorage _storage;

  SecureStorageService({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const String _keyFcmToken = 'dork_fcm_token';
  static const String _keyPreferredTheme = 'dork_theme';
  static const String _keyLanguage = 'dork_language';

  Future<void> saveFcmToken(String token) async {
    await _storage.write(key: _keyFcmToken, value: token);
  }

  Future<String?> getFcmToken() async {
    return await _storage.read(key: _keyFcmToken);
  }

  Future<void> saveLanguage(String langCode) async {
    await _storage.write(key: _keyLanguage, value: langCode);
  }

  Future<String?> getLanguage() async {
    return await _storage.read(key: _keyLanguage);
  }

  Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
