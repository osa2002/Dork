import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'qr_parser.dart';

import '../../features/shop_discovery/presentation/screens/shop_discovery_screen.dart';
import '../../features/queue/presentation/screens/ticket_detail_screen.dart';

/// Centralized GoRouter navigation for Dork Mobile V1
class AppRouter {
  static final GoRouter router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('Dork Customer Mobile V1')),
        ),
      ),
      GoRoute(
        path: '/portal/:slug',
        builder: (context, state) {
          final slug = state.pathParameters['slug'] ?? '';
          return ShopDiscoveryScreen(identifier: slug);
        },
      ),
      GoRoute(
        path: '/shop/:identifier',
        builder: (context, state) {
          final identifier = state.pathParameters['identifier'] ?? '';
          return ShopDiscoveryScreen(identifier: identifier);
        },
      ),
      GoRoute(
        path: '/ticket/:ticketId',
        builder: (context, state) {
          final ticketId = state.pathParameters['ticketId'] ?? '';
          return TicketDetailScreen(ticketId: ticketId);
        },
      ),
      GoRoute(
        path: '/history',
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('Ticket History')),
        ),
      ),
    ],
    onException: (context, state, router) {
      router.go('/');
    },
  );

  /// Handles deep links scanned via QR
  static void handleQrUrl(BuildContext context, String rawUrl) {
    final slug = QrParser.parsePortalSlug(rawUrl);
    if (slug != null && slug.isNotEmpty) {
      context.go('/shop/$slug');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invalid Dork QR Code')),
      );
    }
  }
}
