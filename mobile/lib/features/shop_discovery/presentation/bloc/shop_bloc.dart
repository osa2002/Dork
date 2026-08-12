import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/error/failures.dart';
import '../../domain/entities/shop_entity.dart';
import '../../domain/usecases/get_shop.dart';

// Events
abstract class ShopEvent extends Equatable {
  const ShopEvent();
  @override
  List<Object?> get props => [];
}

class FetchShopEvent extends ShopEvent {
  final String identifier;
  const FetchShopEvent(this.identifier);
  @override
  List<Object?> get props => [identifier];
}

// States
abstract class ShopState extends Equatable {
  const ShopState();
  @override
  List<Object?> get props => [];
}

class ShopInitialState extends ShopState {}

class ShopLoadingState extends ShopState {}

class ShopLoadedState extends ShopState {
  final ShopEntity shop;
  const ShopLoadedState(this.shop);
  @override
  List<Object?> get props => [shop];
}

class ShopErrorState extends ShopState {
  final Failure failure;
  const ShopErrorState(this.failure);
  @override
  List<Object?> get props => [failure];
}

// BLoC
class ShopBloc extends Bloc<ShopEvent, ShopState> {
  final GetShop _getShop;

  ShopBloc({required GetShop getShop})
      : _getShop = getShop,
        super(ShopInitialState()) {
    on<FetchShopEvent>(_onFetchShop);
  }

  Future<void> _onFetchShop(
    FetchShopEvent event,
    Emitter<ShopState> emit,
  ) async {
    emit(ShopLoadingState());
    final (failure, shop) = await _getShop(event.identifier);
    if (failure != null) {
      emit(ShopErrorState(failure));
    } else if (shop != null) {
      emit(ShopLoadedState(shop));
    } else {
      emit(const ShopErrorState(NotFoundFailure(message: 'Shop not found')));
    }
  }
}
