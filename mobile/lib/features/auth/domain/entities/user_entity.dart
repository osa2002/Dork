import 'package:equatable/equatable.dart';

/// Pure Domain Entity representing the authenticated mobile customer
class UserEntity extends Equatable {
  final String uid;
  final String? email;
  final String? phoneNumber;
  final String? displayName;
  final bool isAnonymous;

  const UserEntity({
    required this.uid,
    this.email,
    this.phoneNumber,
    this.displayName,
    required this.isAnonymous,
  });

  @override
  List<Object?> get props => [uid, email, phoneNumber, displayName, isAnonymous];
}
