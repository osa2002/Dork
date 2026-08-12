import 'package:equatable/equatable.dart';

class ServiceEntity extends Equatable {
  final String id;
  final String name;
  final String description;
  final int avgDurationMinutes;
  final double price;
  final bool isActive;

  const ServiceEntity({
    required this.id,
    required this.name,
    required this.description,
    required this.avgDurationMinutes,
    required this.price,
    required this.isActive,
  });

  @override
  List<Object?> get props => [
        id,
        name,
        description,
        avgDurationMinutes,
        price,
        isActive,
      ];
}
