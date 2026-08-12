import '../../../../core/error/failures.dart';
import '../repositories/messaging_repository.dart';

class RegisterMessagingToken {
  final MessagingRepository _repository;

  RegisterMessagingToken(this._repository);

  Future<(Failure?, bool)> call({
    required String token,
    required String platform,
  }) async {
    if (token.trim().isEmpty) {
      return (const ValidationFailure(message: 'FCM Token cannot be empty'), false);
    }
    final normalizedPlatform = platform.toLowerCase().trim();
    if (normalizedPlatform != 'android' && normalizedPlatform != 'ios') {
      return (const ValidationFailure(message: 'Platform must be android or ios'), false);
    }

    return await _repository.registerToken(
      token: token.trim(),
      platform: normalizedPlatform,
    );
  }
}
