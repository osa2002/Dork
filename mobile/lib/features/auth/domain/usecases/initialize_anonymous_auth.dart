import '../../../../core/error/failures.dart';
import '../entities/user_entity.dart';
import '../repositories/auth_repository.dart';

class InitializeAnonymousAuth {
  final AuthRepository _repository;

  InitializeAnonymousAuth(this._repository);

  Future<(Failure?, UserEntity?)> call() async {
    final existingUser = await _repository.getCurrentUser();
    if (existingUser != null) {
      return (null, existingUser);
    }
    return await _repository.signInAnonymously();
  }
}
