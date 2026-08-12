import '../../../../core/error/failures.dart';
import '../entities/ticket_entity.dart';
import '../repositories/queue_repository.dart';

class GetTicketHistory {
  final QueueRepository _repository;

  GetTicketHistory(this._repository);

  Future<(Failure?, List<TicketEntity>)> call({
    int page = 1,
    int limit = 20,
  }) async {
    return await _repository.getTicketHistory(page: page, limit: limit);
  }
}
