import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/error/failures.dart';
import '../../domain/entities/ticket_entity.dart';
import '../../domain/usecases/create_ticket.dart';
import '../../domain/usecases/cancel_ticket.dart';
import '../../domain/usecases/get_ticket_history.dart';
import '../../domain/usecases/watch_active_ticket.dart';

// Events
abstract class QueueEvent extends Equatable {
  const QueueEvent();
  @override
  List<Object?> get props => [];
}

class JoinQueueEvent extends QueueEvent {
  final String shopId;
  final String serviceId;
  final String customerName;
  final String customerPhone;

  const JoinQueueEvent({
    required this.shopId,
    required this.serviceId,
    required this.customerName,
    required this.customerPhone,
  });

  @override
  List<Object?> get props => [shopId, serviceId, customerName, customerPhone];
}

class CancelTicketQueueEvent extends QueueEvent {
  final String ticketId;
  final String reason;

  const CancelTicketQueueEvent({required this.ticketId, required this.reason});

  @override
  List<Object?> get props => [ticketId, reason];
}

class FetchTicketHistoryQueueEvent extends QueueEvent {
  final int page;
  final int limit;

  const FetchTicketHistoryQueueEvent({this.page = 1, this.limit = 20});

  @override
  List<Object?> get props => [page, limit];
}

class SubscribeActiveTicketQueueEvent extends QueueEvent {
  final String ticketId;

  const SubscribeActiveTicketQueueEvent(this.ticketId);

  @override
  List<Object?> get props => [ticketId];
}

class ActiveTicketUpdatedQueueEvent extends QueueEvent {
  final TicketEntity? ticket;

  const ActiveTicketUpdatedQueueEvent(this.ticket);

  @override
  List<Object?> get props => [ticket];
}

// States
abstract class QueueState extends Equatable {
  const QueueState();
  @override
  List<Object?> get props => [];
}

class QueueInitialState extends QueueState {}

class QueueLoadingState extends QueueState {}

class TicketCreatedState extends QueueState {
  final TicketEntity ticket;

  const TicketCreatedState(this.ticket);

  @override
  List<Object?> get props => [ticket];
}

class ActiveTicketLiveState extends QueueState {
  final TicketEntity? ticket;

  const ActiveTicketLiveState(this.ticket);

  @override
  List<Object?> get props => [ticket];
}

class TicketHistoryLoadedState extends QueueState {
  final List<TicketEntity> tickets;

  const TicketHistoryLoadedState(this.tickets);

  @override
  List<Object?> get props => [tickets];
}

class TicketCancelledState extends QueueState {}

class QueueErrorState extends QueueState {
  final Failure failure;

  const QueueErrorState(this.failure);

  @override
  List<Object?> get props => [failure];
}

// BLoC
class QueueBloc extends Bloc<QueueEvent, QueueState> {
  final CreateTicket _createTicket;
  final CancelTicket _cancelTicket;
  final GetTicketHistory _getTicketHistory;
  final WatchActiveTicket _watchActiveTicket;

  StreamSubscription<TicketEntity?>? _ticketSubscription;

  QueueBloc({
    required CreateTicket createTicket,
    required CancelTicket cancelTicket,
    required GetTicketHistory getTicketHistory,
    required WatchActiveTicket watchActiveTicket,
  })  : _createTicket = createTicket,
        _cancelTicket = cancelTicket,
        _getTicketHistory = getTicketHistory,
        _watchActiveTicket = watchActiveTicket,
        super(QueueInitialState()) {
    on<JoinQueueEvent>(_onJoinQueue);
    on<CancelTicketQueueEvent>(_onCancelTicket);
    on<FetchTicketHistoryQueueEvent>(_onFetchHistory);
    on<SubscribeActiveTicketQueueEvent>(_onSubscribeActiveTicket);
    on<ActiveTicketUpdatedQueueEvent>(_onActiveTicketUpdated);
  }

  Future<void> _onJoinQueue(
    JoinQueueEvent event,
    Emitter<QueueState> emit,
  ) async {
    emit(QueueLoadingState());
    final (failure, ticket) = await _createTicket(
      shopId: event.shopId,
      serviceId: event.serviceId,
      customerName: event.customerName,
      customerPhone: event.customerPhone,
    );

    if (failure != null) {
      emit(QueueErrorState(failure));
    } else if (ticket != null) {
      emit(TicketCreatedState(ticket));
    } else {
      emit(const QueueErrorState(UnknownFailure()));
    }
  }

  Future<void> _onCancelTicket(
    CancelTicketQueueEvent event,
    Emitter<QueueState> emit,
  ) async {
    emit(QueueLoadingState());
    final (failure, success) = await _cancelTicket(
      ticketId: event.ticketId,
      reason: event.reason,
    );

    if (failure != null) {
      emit(QueueErrorState(failure));
    } else if (success) {
      emit(TicketCancelledState());
    } else {
      emit(const QueueErrorState(ServerFailure(message: 'Failed to cancel ticket')));
    }
  }

  Future<void> _onFetchHistory(
    FetchTicketHistoryQueueEvent event,
    Emitter<QueueState> emit,
  ) async {
    emit(QueueLoadingState());
    final (failure, tickets) = await _getTicketHistory(
      page: event.page,
      limit: event.limit,
    );

    if (failure != null) {
      emit(QueueErrorState(failure));
    } else {
      emit(TicketHistoryLoadedState(tickets));
    }
  }

  Future<void> _onSubscribeActiveTicket(
    SubscribeActiveTicketQueueEvent event,
    Emitter<QueueState> emit,
  ) async {
    await _ticketSubscription?.cancel();
    _ticketSubscription = _watchActiveTicket(event.ticketId).listen(
      (ticket) {
        add(ActiveTicketUpdatedQueueEvent(ticket));
      },
    );
  }

  void _onActiveTicketUpdated(
    ActiveTicketUpdatedQueueEvent event,
    Emitter<QueueState> emit,
  ) {
    emit(ActiveTicketLiveState(event.ticket));
  }

  @override
  Future<void> close() {
    _ticketSubscription?.cancel();
    return super.close();
  }
}
