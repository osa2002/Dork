import 'package:equatable/equatable.dart';

class TicketEntity extends Equatable {
  final String id;
  final String ticketNumber;
  final String shopId;
  final String serviceId;
  final String customerName;
  final String customerPhone;
  final String status; // 'waiting', 'serving', 'completed', 'cancelled', 'no_show'
  final int position;
  final int estimatedWaitMinutes;
  final String? counterId;
  final DateTime createdAt;
  final DateTime? calledAt;
  final DateTime? completedAt;

  const TicketEntity({
    required this.id,
    required this.ticketNumber,
    required this.shopId,
    required this.serviceId,
    required this.customerName,
    required this.customerPhone,
    required this.status,
    required this.position,
    required this.estimatedWaitMinutes,
    this.counterId,
    required this.createdAt,
    this.calledAt,
    this.completedAt,
  });

  bool get isActive => status == 'waiting' || status == 'serving' || status == 'scheduled';

  @override
  List<Object?> get props => [
        id,
        ticketNumber,
        shopId,
        serviceId,
        customerName,
        customerPhone,
        status,
        position,
        estimatedWaitMinutes,
        counterId,
        createdAt,
        calledAt,
        completedAt,
      ];
}
