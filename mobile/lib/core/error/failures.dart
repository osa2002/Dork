import 'package:equatable/equatable.dart';

/// Normalized Application/Domain Failures
abstract class Failure extends Equatable {
  final String message;
  final String? code;

  const Failure({required this.message, this.code});

  @override
  List<Object?> get props => [message, code];
}

class NetworkFailure extends Failure {
  const NetworkFailure({super.message = 'No internet connection', super.code = 'NETWORK_ERROR'});
}

class UnauthorizedFailure extends Failure {
  const UnauthorizedFailure({super.message = 'Authentication required', super.code = 'UNAUTHORIZED'});
}

class ForbiddenFailure extends Failure {
  const ForbiddenFailure({super.message = 'You do not have permission', super.code = 'FORBIDDEN'});
}

class NotFoundFailure extends Failure {
  const NotFoundFailure({super.message = 'Requested item not found', super.code = 'NOT_FOUND'});
}

class ValidationFailure extends Failure {
  const ValidationFailure({required super.message, super.code = 'VALIDATION_ERROR'});
}

class ServerFailure extends Failure {
  const ServerFailure({super.message = 'An unexpected server error occurred', super.code = 'SERVER_ERROR'});
}

class TimeoutFailure extends Failure {
  const TimeoutFailure({super.message = 'Request timed out', super.code = 'TIMEOUT'});
}

class CacheFailure extends Failure {
  const CacheFailure({super.message = 'Failed to retrieve cached data', super.code = 'CACHE_ERROR'});
}

class UnknownFailure extends Failure {
  const UnknownFailure({super.message = 'An unexpected error occurred', super.code = 'UNKNOWN_ERROR'});
}
