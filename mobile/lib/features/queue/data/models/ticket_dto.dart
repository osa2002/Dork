import '../entities/ticket_entity.dart';

class TicketDto {
  final String id;
  final String ticketNumber;
  final String shopId;
  final String serviceId;
  final String customerName;
  final String customerPhone;
  final String status;
  final int position;
  final int estimatedWaitMinutes;
  final String? counterId;
  final DateTime createdAt;
  final DateTime? calledAt;
  final DateTime? completedAt;

  TicketDto({
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

  factory TicketDto.fromJson(Map<String, dynamic> json, [String? docId]) {
    DateTime parseDate(dynamic val) {
      if (val == null) return DateTime.now();
      if (val is String) return DateTime.tryParse(val) ?? DateTime.now();
      if (val is int) return DateTime.fromMillisecondsSinceEpoch(val);
      return DateTime.now();
    }

    DateTime? parseNullableDate(dynamic val) {
      if (val == null) return null;
      if (val is String) return DateTime.tryParse(val);
      if (val is int) return DateTime.fromMillisecondsSinceEpoch(val);
      return null;
    }

    return TicketDto(
      id: docId ?? json['id'] ?? json['ticketId'] ?? '',
      ticketNumber: json['ticketNumber']?.toString() ?? json['number']?.toString() ?? '',
      shopId: json['shopId'] ?? '',
      serviceId: json['serviceId'] ?? '',
      customerName: json['customerName'] ?? json['name'] ?? '',
      customerPhone: json['customerPhone'] ?? json['phone'] ?? '',
      status: json['status'] ?? 'waiting',
      position: json['position'] is int ? json['position'] : int.tryParse(json['position']?.toString() ?? '0') ?? 0,
      estimatedWaitMinutes: json['estimatedWaitMinutes'] is int
          ? json['estimatedWaitMinutes']
          : json['estimatedWait'] is int
              ? json['estimatedWait']
              : int.tryParse(json['estimatedWaitMinutes']?.toString() ?? '0') ?? 0,
      counterId: json['counterId']?.toString(),
      createdAt: parseDate(json['createdAt']),
      calledAt: parseNullableDate(json['calledAt']),
      completedAt: parseNullableDate(json['completedAt']),
    );
  }

  TicketEntity toEntity() {
    return TicketEntity(
      id: id,
      ticketNumber: ticketNumber,
      shopId: shopId,
      serviceId: serviceId,
      customerName: customerName,
      customerPhone: customerPhone,
      status: status,
      position: position,
      estimatedWaitMinutes: estimatedWaitMinutes,
      counterId: counterId,
      createdAt: createdAt,
      calledAt: calledAt,
      completedAt: completedAt,
    );
  }
}
