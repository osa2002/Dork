import 'package:flutter_test/flutter_test.dart';
import 'package:dork_customer_mobile/features/queue/data/models/ticket_dto.dart';

void main() {
  group('TicketDto Parsing Tests', () {
    test('should parse backend ticket JSON correctly', () {
      final json = {
        'id': 'ticket_999',
        'ticketNumber': 'A-012',
        'shopId': 'shop_123',
        'serviceId': 'srv_1',
        'customerName': 'Ahmad',
        'customerPhone': '+966512345678',
        'status': 'waiting',
        'position': 3,
        'estimatedWaitMinutes': 15,
        'createdAt': '2026-08-10T10:00:00.000Z',
      };

      final dto = TicketDto.fromJson(json);
      expect(dto.id, equals('ticket_999'));
      expect(dto.ticketNumber, equals('A-012'));
      expect(dto.position, equals(3));
      expect(dto.estimatedWaitMinutes, equals(15));
      expect(dto.status, equals('waiting'));

      final entity = dto.toEntity();
      expect(entity.isActive, isTrue);
      expect(entity.customerName, equals('Ahmad'));
    });
  });
}
