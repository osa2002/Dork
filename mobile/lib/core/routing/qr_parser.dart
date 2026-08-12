import '../config/app_config.dart';

/// Validates and parses Dork QR code URLs safely
class QrParser {
  /// Parses a raw QR string and extracts the shop slug if valid
  static String? parsePortalSlug(String rawUrl) {
    if (rawUrl.isEmpty) return null;

    try {
      final uri = Uri.parse(rawUrl.trim());

      // If scheme is present, validate host against approved origins
      if (uri.hasScheme) {
        if (!uri.scheme.startsWith('http')) return null;
        
        final host = uri.host.toLowerCase();
        final portStr = uri.hasPort ? ':${uri.port}' : '';
        final fullHost = '$host$portStr';

        final isApproved = AppConfig.approvedDorkOrigins.any(
          (approved) => fullHost == approved || host == approved,
        );

        if (!isApproved) return null;
      }

      // Check path segment pattern: /portal/:slug
      final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
      if (segments.length >= 2 && segments[0].toLowerCase() == 'portal') {
        final slug = segments[1].trim();
        if (_isValidSlug(slug)) {
          return slug;
        }
      } else if (segments.length == 1 && _isValidSlug(segments[0])) {
        // Fallback for direct slug QR codes
        return segments[0].trim();
      }
    } catch (_) {
      return null;
    }

    return null;
  }

  static bool _isValidSlug(String slug) {
    final slugRegExp = RegExp(r'^[a-zA-Z0-9_-]{2,64}$');
    return slugRegExp.hasMatch(slug);
  }
}
