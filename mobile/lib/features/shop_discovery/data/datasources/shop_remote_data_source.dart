import '../../../../core/error/exceptions.dart';
import '../../../../core/network/api_client.dart';
import '../models/shop_dto.dart';

abstract class ShopRemoteDataSource {
  Future<ShopDto> getShopByIdentifier(String identifier);
}

class ShopRemoteDataSourceImpl implements ShopRemoteDataSource {
  final ApiClient _apiClient;

  ShopRemoteDataSourceImpl(this._apiClient);

  @override
  Future<ShopDto> getShopByIdentifier(String identifier) async {
    final response = await _apiClient.get('/api/v1/mobile/shops/$identifier');
    final data = response.data;

    if (data is Map<String, dynamic> && data['success'] == true && data['shop'] != null) {
      return ShopDto.fromJson(data['shop'] as Map<String, dynamic>);
    }

    throw ServerException(
      message: 'Failed to retrieve shop details from backend.',
      statusCode: response.statusCode,
    );
  }
}
