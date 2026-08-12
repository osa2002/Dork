import '../../../../core/error/exceptions.dart';
import '../../../../core/network/api_client.dart';
import '../models/ticket_dto.dart';

abstract class QueueRemoteDataSource {
  Future<TicketDto> createTicket({
    required String shopId,
    required String serviceId,
    required String customerName,
    required String customerPhone,
  });

  Future<bool> cancelTicket({
    required String ticketId,
    required String reason,
  });

  Future<List<TicketDto>> getTicketHistory({
    int page = 1,
    int limit = 20,
  });
}

class QueueRemoteDataSourceImpl implements QueueRemoteDataSource {
  final ApiClient _apiClient;

  QueueRemoteDataSourceImpl(this._apiClient);

  @override
  Future<TicketDto> createTicket({
    required String shopId,
    required String serviceId,
    required String customerName,
    required String customerPhone,
  }) async {
    final response = await _apiClient.post(
      '/api/tickets/create',
      data: {
        'shopId': shopId,
        'serviceId': serviceId,
        'customerName': customerName,
        'customerPhone': customerPhone,
      },
    );

    final data = response.data;
    if (data is Map<String, dynamic> && data['ticket'] != null) {
      return TicketDto.fromJson(data['ticket'] as Map<String, dynamic>);
    }

    throw ServerException(
      message: 'Failed to create ticket',
      statusCode: response.statusCode,
    );
  }

  @override
  Future<bool> cancelTicket({
    required String ticketId,
    required String reason,
  }) async {
    final response = await _apiClient.post(
      '/api/v1/mobile/tickets/cancel',
      data: {
        'ticketId': ticketId,
        'reason': reason,
      },
    );

    final data = response.data;
    if (data is Map<String, dynamic> && data['success'] == true) {
      return true;
    }

    return false;
  }

  @override
  Future<List<TicketDto>> getTicketHistory({
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _apiClient.get(
      '/api/v1/mobile/tickets/history',
      queryParameters: {
        'page': page,
        'limit': limit,
      },
    );

    final data = response.data;
    if (data is Map<String, dynamic> && data['tickets'] is List) {
      final list = data['tickets'] as List<dynamic>;
      return list
          .map((t) => TicketDto.fromJson(t as Map<String, dynamic>))
          .toList();
    }

    return [];
  }
}
