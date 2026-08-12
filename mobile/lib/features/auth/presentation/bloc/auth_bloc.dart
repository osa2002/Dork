import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/error/failures.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/usecases/initialize_anonymous_auth.dart';

// Events
abstract class AuthEvent extends Equatable {
  const AuthEvent();
  @override
  List<Object?> get props => [];
}

class AppStartedAuthEvent extends AuthEvent {}

// States
abstract class AuthState extends Equatable {
  const AuthState();
  @override
  List<Object?> get props => [];
}

class AuthInitialState extends AuthState {}

class AuthLoadingState extends AuthState {}

class AuthenticatedState extends AuthState {
  final UserEntity user;
  const AuthenticatedState(this.user);
  @override
  List<Object?> get props => [user];
}

class AuthErrorState extends AuthState {
  final Failure failure;
  const AuthErrorState(this.failure);
  @override
  List<Object?> get props => [failure];
}

// BLoC
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final InitializeAnonymousAuth _initializeAnonymousAuth;

  AuthBloc({required InitializeAnonymousAuth initializeAnonymousAuth})
      : _initializeAnonymousAuth = initializeAnonymousAuth,
        super(AuthInitialState()) {
    on<AppStartedAuthEvent>(_onAppStarted);
  }

  Future<void> _onAppStarted(
    AppStartedAuthEvent event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoadingState());
    final (failure, user) = await _initializeAnonymousAuth();
    if (failure != null) {
      emit(AuthErrorState(failure));
    } else if (user != null) {
      emit(AuthenticatedState(user));
    } else {
      emit(const AuthErrorState(UnknownFailure()));
    }
  }
}
