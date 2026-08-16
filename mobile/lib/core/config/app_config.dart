/// Global Application Configuration for Dork Mobile V1
class AppConfig {
  static const String appName = 'Dork Mobile';
  static const String apiVersion = 'v1';
  
  // Production / Development Backend API Base URL
  // Default to window origin or environment variable proxy
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );
  static const String apiBaseUrl = baseUrl;

  static const List<String> approvedDorkOrigins = [
    'localhost:3000',
    'localhost:5173',
    'ais-dev-65gxjwu37m3oq7zl65cayo-515197504824.europe-west2.run.app',
    'ais-pre-65gxjwu37m3oq7zl65cayo-515197504824.europe-west2.run.app',
    'dork.digital',
  ];

  static const int connectionTimeoutMs = 15000;
  static const int receiveTimeoutMs = 15000;
  static const Duration networkTimeout = Duration(seconds: 15);
}
