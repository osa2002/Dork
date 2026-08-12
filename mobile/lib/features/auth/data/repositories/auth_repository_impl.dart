import '../../../../core/error/failures.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_data_source.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource _remoteDataSource;

  AuthRepositoryImpl(this._remoteDataSource);

  @override
  Future<(Failure?, UserEntity?)> signInAnonymously() async {
    try {
      final user = await _remoteDataSource.signInAnonymously();
      return (null, user);
    } catch (e) {
      return (UnauthorizedFailure(message: e.toString()), null);
    }
  }

  @override
  Future<UserEntity?> getCurrentUser() async {
    return _remoteDataSource.getCurrentUser();
  }

  @override
  Future<String?> getIdToken({bool forceRefresh = false}) async {
    return await _remoteDataSource.getIdToken(forceRefresh: forceRefresh);
  }

  @override
  Future<void> signOut() async {
    await _remoteDataSource.signOut();
  }
}
