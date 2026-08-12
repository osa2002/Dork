import 'package:dio/dio.dart';
import '../error/exceptions.dart';

/// Translates raw Dio errors into structured application exceptions
class ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    Exception mappedException;

    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.connectionError:
        mappedException = NetworkException('Connection timeout or network failure');
        break;

      case DioExceptionType.badResponse:
        final statusCode = err.response?.statusCode;
        final data = err.response?.data;
        String message = 'An unexpected server error occurred';

        if (data is Map<String, dynamic>) {
          message = data['error'] ?? data['message'] ?? message;
        }

        if (statusCode == 401) {
          mappedException = UnauthorizedException(message);
        } else if (statusCode == 403) {
          mappedException = ForbiddenException(message);
        } else if (statusCode == 404) {
          mappedException = NotFoundException(message);
        } else if (statusCode == 400 || statusCode == 422) {
          mappedException = ValidationException(message);
        } else {
          mappedException = ServerException(
            message: message,
            statusCode: statusCode,
          );
        }
        break;

      case DioExceptionType.cancel:
        mappedException = NetworkException('Request cancelled');
        break;

      default:
        mappedException = ServerException(message: err.message ?? 'Unknown network error');
        break;
    }

    return handler.reject(
      DioException(
        requestOptions: err.requestOptions,
        response: err.response,
        type: err.type,
        error: mappedException,
      ),
    );
  }
}
