import '../../../../core/error/failures.dart';
import '../entities/ticket_entity.dart';

abstract class QueueRepository {
  Future<(Failure?, TicketEntity?)> createTicket({
    required String shopId,
    required String serviceId,
    required String customerName,
    required String customerPhone,
  });

  Future<(Failure?, bool)> cancelTicket({
    required String ticketId,
    required String reason,
  });

  Future<(Failure?, List<TicketEntity>)> getTicketHistory({
    int page = 1,
    int limit = 20,
  });
}
