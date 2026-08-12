import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import '../config/app_config.dart';
import '../network/api_client.dart';
import '../network/auth_interceptor.dart';
import '../network/correlation_interceptor.dart';
import '../network/error_interceptor.dart';

import '../../features/auth/data/datasources/auth_remote_data_source.dart';
import '../../features/auth/data/repositories/auth_repository_impl.dart';
import '../../features/auth/domain/repositories/auth_repository.dart';
import '../../features/auth/domain/usecases/initialize_anonymous_auth.dart';
import '../../features/auth/presentation/bloc/auth_bloc.dart';

import '../../features/shop_discovery/data/datasources/shop_remote_data_source.dart';
import '../../features/shop_discovery/data/repositories/shop_repository_impl.dart';
import '../../features/shop_discovery/domain/repositories/shop_repository.dart';
import '../../features/shop_discovery/domain/usecases/get_shop.dart';
import '../../features/shop_discovery/presentation/bloc/shop_bloc.dart';

import '../../features/queue/data/datasources/queue_remote_data_source.dart';
import '../../features/queue/data/datasources/ticket_firestore_data_source.dart';
import '../../features/queue/data/repositories/queue_repository_impl.dart';
import '../../features/queue/domain/repositories/queue_repository.dart';
import '../../features/queue/domain/usecases/create_ticket.dart';
import '../../features/queue/domain/usecases/cancel_ticket.dart';
import '../../features/queue/domain/usecases/get_ticket_history.dart';
import '../../features/queue/domain/usecases/watch_active_ticket.dart';
import '../../features/queue/presentation/bloc/queue_bloc.dart';

import '../../features/messaging/data/datasources/messaging_remote_data_source.dart';
import '../../features/messaging/data/repositories/messaging_repository_impl.dart';
import '../../features/messaging/domain/repositories/messaging_repository.dart';
import '../../features/messaging/domain/usecases/register_messaging_token.dart';
import '../../features/messaging/presentation/bloc/messaging_bloc.dart';

/// Central Service Locator / Dependency Injection for Dork Mobile V1
class DependencyInjection {
  static late final ApiClient apiClient;

  // Auth
  static late final AuthRemoteDataSource authRemoteDataSource;
  static late final AuthRepository authRepository;
  static late final InitializeAnonymousAuth initializeAnonymousAuth;

  // Shop Discovery
  static late final ShopRemoteDataSource shopRemoteDataSource;
  static late final ShopRepository shopRepository;
  static late final GetShop getShop;

  // Queue
  static late final QueueRemoteDataSource queueRemoteDataSource;
  static late final TicketFirestoreDataSource ticketFirestoreDataSource;
  static late final QueueRepositoryImpl queueRepository;
  static late final CreateTicket createTicket;
  static late final CancelTicket cancelTicket;
  static late final GetTicketHistory getTicketHistory;
  static late final WatchActiveTicket watchActiveTicket;

  // Messaging
  static late final MessagingRemoteDataSource messagingRemoteDataSource;
  static late final MessagingRepository messagingRepository;
  static late final RegisterMessagingToken registerMessagingToken;

  static void init({
    String? baseUrl,
    FirebaseAuth? firebaseAuth,
    FirebaseFirestore? firestore,
  }) {
    final dio = Dio(
      BaseOptions(
        baseUrl: baseUrl ?? AppConfig.apiBaseUrl,
        connectTimeout: const Duration(milliseconds: AppConfig.connectionTimeoutMs),
        receiveTimeout: const Duration(milliseconds: AppConfig.receiveTimeoutMs),
      ),
    );

    final auth = firebaseAuth ?? FirebaseAuth.instance;
    final db = firestore ?? FirebaseFirestore.instance;

    dio.interceptors.addAll([
      CorrelationInterceptor(),
      AuthInterceptor(firebaseAuth: auth),
      ErrorInterceptor(),
    ]);

    apiClient = ApiClient(dio);

    // Auth
    authRemoteDataSource = AuthRemoteDataSourceImpl(firebaseAuth: auth);
    authRepository = AuthRepositoryImpl(authRemoteDataSource);
    initializeAnonymousAuth = InitializeAnonymousAuth(authRepository);

    // Shop
    shopRemoteDataSource = ShopRemoteDataSourceImpl(apiClient);
    shopRepository = ShopRepositoryImpl(shopRemoteDataSource);
    getShop = GetShop(shopRepository);

    // Queue
    queueRemoteDataSource = QueueRemoteDataSourceImpl(apiClient);
    ticketFirestoreDataSource = TicketFirestoreDataSourceImpl(firestore: db);
    queueRepository = QueueRepositoryImpl(
      remoteDataSource: queueRemoteDataSource,
      firestoreDataSource: ticketFirestoreDataSource,
    );
    createTicket = CreateTicket(queueRepository);
    cancelTicket = CancelTicket(queueRepository);
    getTicketHistory = GetTicketHistory(queueRepository);
    watchActiveTicket = WatchActiveTicket(queueRepository);

    // Messaging
    messagingRemoteDataSource = MessagingRemoteDataSourceImpl(apiClient);
    messagingRepository = MessagingRepositoryImpl(messagingRemoteDataSource);
    registerMessagingToken = RegisterMessagingToken(messagingRepository);
  }

  static AuthBloc createAuthBloc() => AuthBloc(
        initializeAnonymousAuth: initializeAnonymousAuth,
      );

  static ShopBloc createShopBloc() => ShopBloc(getShop: getShop);

  static QueueBloc createQueueBloc() => QueueBloc(
        createTicket: createTicket,
        cancelTicket: cancelTicket,
        getTicketHistory: getTicketHistory,
        watchActiveTicket: watchActiveTicket,
      );

  static MessagingBloc createMessagingBloc() => MessagingBloc(
        registerMessagingToken: registerMessagingToken,
      );
}
