import '../entities/ticket_entity.dart';
import '../repositories/ticket_realtime_repository.dart';

class WatchActiveTicket {
  final TicketRealtimeRepository _realtimeRepository;

  WatchActiveTicket(this._realtimeRepository);

  Stream<TicketEntity?> call(String ticketId) {
    if (ticketId.trim().isEmpty) {
      return Stream.value(null);
    }
    return _realtimeRepository.watchTicket(ticketId.trim());
  }
}
