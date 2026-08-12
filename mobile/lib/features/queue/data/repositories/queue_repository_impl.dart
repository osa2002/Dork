import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/ticket_entity.dart';
import '../../domain/repositories/queue_repository.dart';
import '../../domain/repositories/ticket_realtime_repository.dart';
import '../datasources/queue_remote_data_source.dart';
import '../datasources/ticket_firestore_data_source.dart';

class QueueRepositoryImpl implements QueueRepository, TicketRealtimeRepository {
  final QueueRemoteDataSource _remoteDataSource;
  final TicketFirestoreDataSource _firestoreDataSource;

  QueueRepositoryImpl({
    required QueueRemoteDataSource remoteDataSource,
    required TicketFirestoreDataSource firestoreDataSource,
  })  : _remoteDataSource = remoteDataSource,
        _firestoreDataSource = firestoreDataSource;

  @override
  Future<(Failure?, TicketEntity?)> createTicket({
    required String shopId,
    required String serviceId,
    required String customerName,
    required String customerPhone,
  }) async {
    try {
      final dto = await _remoteDataSource.createTicket(
        shopId: shopId,
        serviceId: serviceId,
        customerName: customerName,
        customerPhone: customerPhone,
      );
      return (null, dto.toEntity());
    } on NetworkException catch (e) {
      return (NetworkFailure(message: e.message), null);
    } on ServerException catch (e) {
      return (ServerFailure(message: e.message), null);
    } catch (e) {
      return (UnknownFailure(message: e.toString()), null);
    }
  }

  @override
  Future<(Failure?, bool)> cancelTicket({
    required String ticketId,
    required String reason,
  }) async {
    try {
      final success = await _remoteDataSource.cancelTicket(
        ticketId: ticketId,
        reason: reason,
      );
      if (success) {
        return (null, true);
      }
      return (const ServerFailure(message: 'Cancellation was declined by server'), false);
    } on NetworkException catch (e) {
      return (NetworkFailure(message: e.message), false);
    } on ServerException catch (e) {
      return (ServerFailure(message: e.message), false);
    } catch (e) {
      return (UnknownFailure(message: e.toString()), false);
    }
  }

  @override
  Future<(Failure?, List<TicketEntity>)> getTicketHistory({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final dtos = await _remoteDataSource.getTicketHistory(page: page, limit: limit);
      final entities = dtos.map((d) => d.toEntity()).toList();
      return (null, entities);
    } on NetworkException catch (e) {
      return (NetworkFailure(message: e.message), []);
    } on ServerException catch (e) {
      return (ServerFailure(message: e.message), []);
    } catch (e) {
      return (UnknownFailure(message: e.toString()), []);
    }
  }

  @override
  Stream<TicketEntity?> watchTicket(String ticketId) {
    return _firestoreDataSource
        .watchTicket(ticketId)
        .map((dto) => dto?.toEntity());
  }
}
