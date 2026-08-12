import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';

/// Attaches unique X-Correlation-ID header to every request
class CorrelationInterceptor extends Interceptor {
  final Uuid _uuid;

  CorrelationInterceptor({Uuid? uuid}) : _uuid = uuid ?? const Uuid();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (!options.headers.containsKey('X-Correlation-ID')) {
      options.headers['X-Correlation-ID'] = _uuid.v4();
    }
    return handler.next(options);
  }
}
