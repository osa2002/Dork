import '../../../../core/error/failures.dart';
import '../entities/shop_entity.dart';
import '../repositories/shop_repository.dart';

class GetShop {
  final ShopRepository _repository;

  GetShop(this._repository);

  Future<(Failure?, ShopEntity?)> call(String identifier) async {
    if (identifier.trim().isEmpty) {
      return (const ValidationFailure(message: 'Shop identifier is required'), null);
    }
    return await _repository.getShopByIdentifier(identifier.trim());
  }
}
