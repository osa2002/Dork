import '../../../../core/error/failures.dart';
import '../entities/shop_entity.dart';

abstract class ShopRepository {
  Future<(Failure?, ShopEntity?)> getShopByIdentifier(String identifier);
}
