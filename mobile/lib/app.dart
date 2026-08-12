import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/di/injection.dart';
import 'core/localization/app_localizations.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/bloc/auth_bloc.dart';

class DorkCustomerApp extends StatelessWidget {
  const DorkCustomerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthBloc>(
          create: (_) => DependencyInjection.createAuthBloc()..add(AppStartedAuthEvent()),
        ),
        BlocProvider<ShopBloc>(
          create: (_) => DependencyInjection.createShopBloc(),
        ),
        BlocProvider<QueueBloc>(
          create: (_) => DependencyInjection.createQueueBloc(),
        ),
        BlocProvider<MessagingBloc>(
          create: (_) => DependencyInjection.createMessagingBloc(),
        ),
      ],
      child: MaterialApp.router(
        title: 'Dork Mobile V1',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.system,
        routerConfig: AppRouter.router,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
      ),
    );
  }
}
