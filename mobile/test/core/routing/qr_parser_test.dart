import 'package:flutter_test/flutter_test.dart';
import 'package:dork_customer_mobile/core/routing/qr_parser.dart';

void main() {
  group('QrParser Security & Format Tests', () {
    test('should parse valid Dork origin portal URL', () {
      const validUrl = 'https://dork.digital/portal/salon-pro';
      final slug = QrParser.parsePortalSlug(validUrl);
      expect(slug, equals('salon-pro'));
    });

    test('should parse localhost portal URL', () {
      const validUrl = 'http://localhost:3000/portal/test-shop';
      final slug = QrParser.parsePortalSlug(validUrl);
      expect(slug, equals('test-shop'));
    });

    test('should reject untrusted external origin URL', () {
      const maliciousUrl = 'https://evil-phishing-site.com/portal/stolen-shop';
      final slug = QrParser.parsePortalSlug(maliciousUrl);
      expect(slug, isNull);
    });

    test('should reject malformed URL strings', () {
      expect(QrParser.parsePortalSlug(''), isNull);
      expect(QrParser.parsePortalSlug('not a url'), isNull);
    });
  });
}
