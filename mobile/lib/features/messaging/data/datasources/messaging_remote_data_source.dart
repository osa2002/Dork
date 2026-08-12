import '../../../../core/error/exceptions.dart';
import '../../../../core/network/api_client.dart';

abstract class MessagingRemoteDataSource {
  Future<bool> registerToken({
    required String token,
    required String platform,
  });
}

class MessagingRemoteDataSourceImpl implements MessagingRemoteDataSource {
  final ApiClient _apiClient;

  MessagingRemoteDataSourceImpl(this._apiClient);

  @override
  Future<bool> registerToken({
    required String token,
    required String platform,
  }) async {
    final response = await _apiClient.post(
      '/api/v1/mobile/messaging/register-token',
      data: {
        'token': token,
        'platform': platform,
      },
    );

    final data = response.data;
    if (data is Map<String, dynamic> && data['success'] == true) {
      return true;
    }

    throw ServerException(
      message: 'Failed to register FCM token with backend.',
      statusCode: response.statusCode,
    );
  }
}
