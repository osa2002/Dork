import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/repositories/messaging_repository.dart';
import '../datasources/messaging_remote_data_source.dart';

class MessagingRepositoryImpl implements MessagingRepository {
  final MessagingRemoteDataSource _remoteDataSource;

  MessagingRepositoryImpl(this._remoteDataSource);

  @override
  Future<(Failure?, bool)> registerToken({
    required String token,
    required String platform,
  }) async {
    try {
      final success = await _remoteDataSource.registerToken(
        token: token,
        platform: platform,
      );
      return (null, success);
    } on NetworkException catch (e) {
      return (NetworkFailure(message: e.message), false);
    } on ServerException catch (e) {
      return (ServerFailure(message: e.message), false);
    } catch (e) {
      return (UnknownFailure(message: e.toString()), false);
    }
  }
}
