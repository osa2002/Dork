import 'package:flutter_test/flutter_test.dart';
import 'package:dork_customer_mobile/features/shop_discovery/data/models/shop_dto.dart';

void main() {
  group('ShopDto Parsing Tests', () {
    test('should parse backend JSON response correctly', () {
      final json = {
        'id': 'shop_123',
        'name': 'Dork Barber Shop',
        'slug': 'dork-barber',
        'logoUrl': 'https://example.com/logo.png',
        'address': 'Main Street 123',
        'phone': '+966500000000',
        'isOpen': true,
        'workingHours': '09:00 - 21:00',
        'timezone': 'Asia/Riyadh',
        'displayTheme': 'dark',
        'services': [
          {
            'id': 'srv_1',
            'name': 'Haircut',
            'description': 'Standard haircut',
            'avgDurationMinutes': 20,
            'price': 50.0,
            'isActive': true,
          }
        ]
      };

      final dto = ShopDto.fromJson(json);
      expect(dto.id, equals('shop_123'));
      expect(dto.name, equals('Dork Barber Shop'));
      expect(dto.slug, equals('dork-barber'));
      expect(dto.services.length, equals(1));
      expect(dto.services.first.name, equals('Haircut'));

      final entity = dto.toEntity();
      expect(entity.name, equals('Dork Barber Shop'));
      expect(entity.services.first.price, equals(50.0));
    });
  });
}
