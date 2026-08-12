import '../entities/ticket_entity.dart';

abstract class TicketRealtimeRepository {
  /// Listens to real-time updates for a ticket at `/tickets/{ticketId}`
  Stream<TicketEntity?> watchTicket(String ticketId);
}
