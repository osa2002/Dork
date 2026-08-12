import '../../../../core/error/failures.dart';
import '../repositories/queue_repository.dart';

class CancelTicket {
  final QueueRepository _repository;

  CancelTicket(this._repository);

  Future<(Failure?, bool)> call({
    required String ticketId,
    required String reason,
  }) async {
    if (ticketId.trim().isEmpty) {
      return (const ValidationFailure(message: 'Ticket ID is required'), false);
    }
    return await _repository.cancelTicket(
      ticketId: ticketId.trim(),
      reason: reason.trim().isEmpty ? 'Customer requested cancellation' : reason.trim(),
    );
  }
}
