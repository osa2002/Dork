import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/shop_entity.dart';
import '../../domain/repositories/shop_repository.dart';
import '../datasources/shop_remote_data_source.dart';

class ShopRepositoryImpl implements ShopRepository {
  final ShopRemoteDataSource _remoteDataSource;

  ShopRepositoryImpl(this._remoteDataSource);

  @override
  Future<(Failure?, ShopEntity?)> getShopByIdentifier(String identifier) async {
    try {
      final shopDto = await _remoteDataSource.getShopByIdentifier(identifier);
      return (null, shopDto.toEntity());
    } on NotFoundException catch (e) {
      return (NotFoundFailure(message: e.message), null);
    } on NetworkException catch (e) {
      return (NetworkFailure(message: e.message), null);
    } on ServerException catch (e) {
      return (ServerFailure(message: e.message), null);
    } catch (e) {
      return (UnknownFailure(message: e.toString()), null);
    }
  }
}
