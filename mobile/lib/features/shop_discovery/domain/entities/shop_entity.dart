import 'package:equatable/equatable.dart';
import 'service_entity.dart';

class ShopEntity extends Equatable {
  final String id;
  final String name;
  final String slug;
  final String logoUrl;
  final String bannerUrl;
  final String address;
  final String phone;
  final bool isOpen;
  final String workingHours;
  final String timezone;
  final String displayTheme;
  final List<ServiceEntity> services;

  const ShopEntity({
    required this.id,
    required this.name,
    required this.slug,
    required this.logoUrl,
    required this.bannerUrl,
    required this.address,
    required this.phone,
    required this.isOpen,
    required this.workingHours,
    required this.timezone,
    required this.displayTheme,
    required this.services,
  });

  @override
  List<Object?> get props => [
        id,
        name,
        slug,
        logoUrl,
        bannerUrl,
        address,
        phone,
        isOpen,
        workingHours,
        timezone,
        displayTheme,
        services,
      ];
}
