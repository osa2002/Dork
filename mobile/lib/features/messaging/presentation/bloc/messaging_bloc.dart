import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/error/failures.dart';
import '../../domain/usecases/register_messaging_token.dart';

// Events
abstract class MessagingEvent extends Equatable {
  const MessagingEvent();
  @override
  List<Object?> get props => [];
}

class RegisterFcmTokenEvent extends MessagingEvent {
  final String token;
  final String platform;

  const RegisterFcmTokenEvent({required this.token, required this.platform});

  @override
  List<Object?> get props => [token, platform];
}

// States
abstract class MessagingState extends Equatable {
  const MessagingState();
  @override
  List<Object?> get props => [];
}

class MessagingInitialState extends MessagingState {}

class MessagingRegisteringState extends MessagingState {}

class MessagingRegisteredState extends MessagingState {}

class MessagingErrorState extends MessagingState {
  final Failure failure;

  const MessagingErrorState(this.failure);

  @override
  List<Object?> get props => [failure];
}

// BLoC
class MessagingBloc extends Bloc<MessagingEvent, MessagingState> {
  final RegisterMessagingToken _registerMessagingToken;

  MessagingBloc({required RegisterMessagingToken registerMessagingToken})
      : _registerMessagingToken = registerMessagingToken,
        super(MessagingInitialState()) {
    on<RegisterFcmTokenEvent>(_onRegisterToken);
  }

  Future<void> _onRegisterToken(
    RegisterFcmTokenEvent event,
    Emitter<MessagingState> emit,
  ) async {
    emit(MessagingRegisteringState());
    final (failure, success) = await _registerMessagingToken(
      token: event.token,
      platform: event.platform,
    );

    if (failure != null) {
      emit(MessagingErrorState(failure));
    } else if (success) {
      emit(MessagingRegisteredState());
    } else {
      emit(const MessagingErrorState(ServerFailure(message: 'Token registration failed')));
    }
  }
}
