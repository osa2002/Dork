import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../bloc/queue_bloc.dart';

class TicketDetailScreen extends StatefulWidget {
  final String ticketId;

  const TicketDetailScreen({super.key, required this.ticketId});

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<QueueBloc>().add(SubscribeActiveTicketQueueEvent(widget.ticketId));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Live Queue Ticket'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/'),
        ),
      ),
      body: BlocListener<QueueBloc, QueueState>(
        listener: (context, state) {
          if (state is TicketCancelledState) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Ticket cancelled successfully')),
            );
            context.go('/');
          } else if (state is QueueErrorState) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Error: ${state.failure.message}')),
            );
          }
        },
        child: BlocBuilder<QueueBloc, QueueState>(
          builder: (context, state) {
            if (state is QueueLoadingState) {
              return const Center(child: CircularProgressIndicator());
            }

            if (state is ActiveTicketLiveState) {
              final ticket = state.ticket;
              if (ticket == null) {
                return const Center(
                  child: Text('Ticket not found or no longer active.'),
                );
              }

              final isCancelled = ticket.status.toLowerCase() == 'cancelled';
              final isCompleted = ticket.status.toLowerCase() == 'completed';

              return SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  children: [
                    // Ticket Card Banner
                    Card(
                      elevation: 4,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Column(
                          children: [
                            Text(
                              'YOUR TICKET NUMBER',
                              style: Theme.of(context).textTheme.labelLarge,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              ticket.ticketNumber,
                              style: Theme.of(context).textTheme.displayMedium?.copyWith(
                                    fontWeight: FontWeight.bold,
                                    color: Theme.of(context).primaryColor,
                                  ),
                            ),
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                              decoration: BoxDecoration(
                                color: _getStatusColor(ticket.status).withOpacity(0.15),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                ticket.status.toUpperCase(),
                                style: TextStyle(
                                  color: _getStatusColor(ticket.status),
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Real-Time Queue Metrics
                    Row(
                      children: [
                        Expanded(
                          child: _buildMetricCard(
                            context,
                            title: 'Position in Queue',
                            value: '${ticket.position}',
                            icon: Icons.format_list_numbered,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: _buildMetricCard(
                            context,
                            title: 'Est. Wait Time',
                            value: '${ticket.estimatedWaitMinutes} min',
                            icon: Icons.timer,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Customer Details Card
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.person_outline),
                        title: Text(ticket.customerName),
                        subtitle: Text(ticket.customerPhone.isNotEmpty ? ticket.customerPhone : 'No phone provided'),
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Actions
                    if (!isCancelled && !isCompleted)
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: OutlinedButton.icon(
                          onPressed: () {
                            _showCancelDialog(context, ticket.id);
                          },
                          icon: const Icon(Icons.cancel_outlined, color: Colors.red),
                          label: const Text(
                            'Cancel Ticket',
                            style: TextStyle(color: Colors.red),
                          ),
                        ),
                      ),
                  ],
                ),
              );
            }

            return const Center(child: CircularProgressIndicator());
          },
        ),
      ),
    );
  }

  Widget _buildMetricCard(
    BuildContext context, {
    required String title,
    required String value,
    required IconData icon,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Icon(icon, color: Theme.of(context).primaryColor),
            const SizedBox(height: 8),
            Text(title, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 4),
            Text(
              value,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'waiting':
        return Colors.orange;
      case 'called':
      case 'serving':
        return Colors.green;
      case 'completed':
        return Colors.blue;
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  void _showCancelDialog(BuildContext context, String ticketId) {
    final reasonController = TextEditingController();
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancel Ticket'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Are you sure you want to cancel your ticket?'),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(
                labelText: 'Reason for cancellation (optional)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Keep Ticket'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () {
              Navigator.of(dialogContext).pop();
              context.read<QueueBloc>().add(
                    CancelTicketQueueEvent(
                      ticketId: ticketId,
                      reason: reasonController.text.trim().isEmpty
                          ? 'Cancelled by customer'
                          : reasonController.text.trim(),
                    ),
                  );
            },
            child: const Text('Confirm Cancel'),
          ),
        ],
      ),
    );
  }
}
