import '../../../../core/error/failures.dart';
import '../entities/ticket_entity.dart';
import '../repositories/queue_repository.dart';

class CreateTicket {
  final QueueRepository _repository;

  CreateTicket(this._repository);

  Future<(Failure?, TicketEntity?)> call({
    required String shopId,
    required String serviceId,
    required String customerName,
    required String customerPhone,
  }) async {
    if (shopId.trim().isEmpty) {
      return (const ValidationFailure(message: 'Shop ID is required'), null);
    }
    if (serviceId.trim().isEmpty) {
      return (const ValidationFailure(message: 'Service ID is required'), null);
    }
    if (customerName.trim().length < 2) {
      return (const ValidationFailure(message: 'Customer name is too short'), null);
    }

    return await _repository.createTicket(
      shopId: shopId.trim(),
      serviceId: serviceId.trim(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
    );
  }
}
