import '../../../../core/error/failures.dart';

abstract class MessagingRepository {
  Future<(Failure?, bool)> registerToken({
    required String token,
    required String platform,
  });
}
