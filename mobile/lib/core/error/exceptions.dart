/// Domain Exceptions for Dork Mobile Infrastructure Layer

class ServerException implements Exception {
  final String message;
  final int? statusCode;
  final String? code;

  ServerException({required this.message, this.statusCode, this.code});

  @override
  String toString() => 'ServerException: [$statusCode] $code - $message';
}

class NetworkException implements Exception {
  final String message;
  NetworkException([this.message = 'Network connection failed']);
}

class UnauthorizedException implements Exception {
  final String message;
  UnauthorizedException([this.message = 'Authentication required']);
}

class ForbiddenException implements Exception {
  final String message;
  ForbiddenException([this.message = 'Access forbidden']);
}

class NotFoundException implements Exception {
  final String message;
  NotFoundException([this.message = 'Requested resource not found']);
}

class ValidationException implements Exception {
  final String message;
  ValidationException([this.message = 'Validation failed']);
}

class CacheException implements Exception {
  final String message;
  CacheException([this.message = 'Local cache error']);
}
