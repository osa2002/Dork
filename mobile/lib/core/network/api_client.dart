import 'package:dio/dio.dart';
import '../config/app_config.dart';
import 'auth_interceptor.dart';
import 'correlation_interceptor.dart';
import 'error_interceptor.dart';

/// Centralized Dio HTTP Client for Dork Mobile V1
class ApiClient {
  late final Dio dio;

  ApiClient({Dio? customDio, String? overrideBaseUrl}) {
    dio = customDio ??
        Dio(
          BaseOptions(
            baseUrl: overrideBaseUrl ?? AppConfig.baseUrl,
            connectTimeout: AppConfig.networkTimeout,
            receiveTimeout: AppConfig.networkTimeout,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          ),
        );

    dio.interceptors.addAll([
      CorrelationInterceptor(),
      AuthInterceptor(),
      ErrorInterceptor(),
    ]);
  }

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await dio.get<T>(
      path,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await dio.post<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }
}
