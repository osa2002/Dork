import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../bloc/shop_bloc.dart';
import '../../../queue/presentation/bloc/queue_bloc.dart';
import '../../domain/entities/service_entity.dart';

class ShopDiscoveryScreen extends StatefulWidget {
  final String identifier;

  const ShopDiscoveryScreen({super.key, required this.identifier});

  @override
  State<ShopDiscoveryScreen> createState() => _ShopDiscoveryScreenState();
}

class _ShopDiscoveryScreenState extends State<ShopDiscoveryScreen> {
  ServiceEntity? _selectedService;
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<ShopBloc>().add(FetchShopEvent(widget.identifier));
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Shop Discovery'),
      ),
      body: BlocListener<QueueBloc, QueueState>(
        listener: (context, state) {
          if (state is TicketCreatedState) {
            context.go('/ticket/${state.ticket.id}');
          } else if (state is QueueErrorState) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Error: ${state.failure.message}')),
            );
          }
        },
        child: BlocBuilder<ShopBloc, ShopState>(
          builder: (context, state) {
            if (state is ShopLoadingState) {
              return const Center(child: CircularProgressIndicator());
            } else if (state is ShopErrorState) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    mainAxisAlignment: MainaxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: Colors.red),
                      const SizedBox(height: 12),
                      Text(
                        state.failure.message,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () {
                          context.read<ShopBloc>().add(FetchShopEvent(widget.identifier));
                        },
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              );
            } else if (state is ShopLoadedState) {
              final shop = state.shop;
              return SingleChildScrollView(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Shop Header
                    Row(
                      children: [
                        if (shop.logoUrl.isNotEmpty)
                          CircleAvatar(
                            radius: 28,
                            backgroundImage: NetworkImage(shop.logoUrl),
                          )
                        else
                          const CircleAvatar(
                            radius: 28,
                            child: Icon(Icons.store),
                          ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                shop.name,
                                style: Theme.of(context).textTheme.headlineSmall,
                              ),
                              Text(
                                shop.address.isNotEmpty ? shop.address : shop.workingHours,
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: shop.isOpen ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            shop.isOpen ? 'OPEN' : 'CLOSED',
                            style: TextStyle(
                              color: shop.isOpen ? Colors.green : Colors.red,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 32),

                    // Services List
                    Text(
                      'Available Services',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    if (shop.services.isEmpty)
                      const Text('No active services available.')
                    else
                      ListView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: shop.services.length,
                        itemBuilder: (context, index) {
                          final service = shop.services[index];
                          final isSelected = _selectedService?.id == service.id;
                          return Card(
                            color: isSelected ? Theme.of(context).primaryColor.withOpacity(0.1) : null,
                            child: ListTile(
                              title: Text(service.name),
                              subtitle: Text(
                                '${service.avgDurationMinutes} mins • \$${service.price.toStringAsFixed(2)}',
                              ),
                              trailing: isSelected
                                  ? const Icon(Icons.check_circle, color: Colors.blue)
                                  : const Icon(Icons.circle_outlined),
                              onTap: () {
                                setState(() {
                                  _selectedService = service;
                                });
                              },
                            ),
                          );
                        },
                      ),

                    const SizedBox(height: 24),

                    // Customer Information Input
                    Text(
                      'Customer Information',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _nameController,
                      decoration: const InputDecoration(
                        labelText: 'Your Name',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.person),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Phone Number',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.phone),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Join Queue Button
                    BlocBuilder<QueueBloc, QueueState>(
                      builder: (context, queueState) {
                        final isLoading = queueState is QueueLoadingState;
                        return SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton.icon(
                            onPressed: isLoading || _selectedService == null
                                ? null
                                : () {
                                    final name = _nameController.text.trim();
                                    final phone = _phoneController.text.trim();

                                    if (name.isEmpty) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('Please enter your name')),
                                      );
                                      return;
                                    }

                                    context.read<QueueBloc>().add(
                                          JoinQueueEvent(
                                            shopId: shop.id,
                                            serviceId: _selectedService!.id,
                                            customerName: name,
                                            customerPhone: phone,
                                          ),
                                        );
                                  },
                            icon: isLoading
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : const Icon(Icons.confirmation_number),
                            label: Text(isLoading ? 'Joining Queue...' : 'Take a Ticket'),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              );
            }
            return const SizedBox.shrink();
          },
        ),
      ),
    );
  }
}
