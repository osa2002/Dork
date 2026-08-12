import '../entities/service_entity.dart';
import '../entities/shop_entity.dart';

class ServiceDto {
  final String id;
  final String name;
  final String description;
  final int avgDurationMinutes;
  final double price;
  final bool isActive;

  ServiceDto({
    required this.id,
    required this.name,
    required this.description,
    required this.avgDurationMinutes,
    required this.price,
    required this.isActive,
  });

  factory ServiceDto.fromJson(Map<String, dynamic> json) {
    return ServiceDto(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      avgDurationMinutes: json['avgDurationMinutes'] ?? json['avgDuration'] ?? 15,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      isActive: json['isActive'] ?? true,
    );
  }

  ServiceEntity toEntity() {
    return ServiceEntity(
      id: id,
      name: name,
      description: description,
      avgDurationMinutes: avgDurationMinutes,
      price: price,
      isActive: isActive,
    );
  }
}

class ShopDto {
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
  final List<ServiceDto> services;

  ShopDto({
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

  factory ShopDto.fromJson(Map<String, dynamic> json) {
    final rawServices = json['services'] as List<dynamic>? ?? [];
    return ShopDto(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      slug: json['slug'] ?? '',
      logoUrl: json['logoUrl'] ?? json['logo'] ?? '',
      bannerUrl: json['bannerUrl'] ?? '',
      address: json['address'] ?? '',
      phone: json['phone'] ?? '',
      isOpen: json['isOpen'] ?? true,
      workingHours: json['workingHours'] ?? '',
      timezone: json['timezone'] ?? 'Asia/Riyadh',
      displayTheme: json['displayTheme'] ?? json['displayBgTheme'] ?? 'dark',
      services: rawServices
          .map((s) => ServiceDto.fromJson(s as Map<String, dynamic>))
          .toList(),
    );
  }

  ShopEntity toEntity() {
    return ShopEntity(
      id: id,
      name: name,
      slug: slug,
      logoUrl: logoUrl,
      bannerUrl: bannerUrl,
      address: address,
      phone: phone,
      isOpen: isOpen,
      workingHours: workingHours,
      timezone: timezone,
      displayTheme: displayTheme,
      services: services.map((s) => s.toEntity()).toList(),
    );
  }
}
