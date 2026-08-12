import 'package:flutter_test/flutter_test.dart';
import 'package:dork_customer_mobile/core/error/failures.dart';
import 'package:dork_customer_mobile/features/messaging/domain/repositories/messaging_repository.dart';
import 'package:dork_customer_mobile/features/messaging/domain/usecases/register_messaging_token.dart';

class MockMessagingRepository implements MessagingRepository {
  @override
  Future<(Failure?, bool)> registerToken({
    required String token,
    required String platform,
  }) async {
    if (token == 'valid_token') {
      return (null, true);
    }
    return (const ServerFailure(message: 'Invalid token'), false);
  }
}

void main() {
  group('RegisterMessagingToken UseCase Tests', () {
    late RegisterMessagingToken useCase;
    late MockMessagingRepository repository;

    setUp(() {
      repository = MockMessagingRepository();
      useCase = RegisterMessagingToken(repository);
    });

    test('should fail if FCM token is empty', () async {
      final (failure, success) = await useCase(token: '', platform: 'android');
      expect(failure, isA<ValidationFailure>());
      expect(success, isFalse);
    });

    test('should fail if platform is invalid', () async {
      final (failure, success) = await useCase(token: 'some_token', platform: 'windows');
      expect(failure, isA<ValidationFailure>());
      expect(success, isFalse);
    });

    test('should succeed with valid token and android platform', () async {
      final (failure, success) = await useCase(token: 'valid_token', platform: 'android');
      expect(failure, isNull);
      expect(success, isTrue);
    });
  });
}
