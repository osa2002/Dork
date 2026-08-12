import 'package:equatable/equatable.dart';

import '../../../../core/error/failures.dart';
import '../entities/user_entity.dart';

abstract class AuthRepository {
  Future<(Failure?, UserEntity?)> signInAnonymously();
  Future<UserEntity?> getCurrentUser();
  Future<String?> getIdToken({bool forceRefresh = false});
  Future<void> signOut();
}
