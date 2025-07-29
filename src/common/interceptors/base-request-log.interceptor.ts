import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Observable, catchError, tap, throwError } from 'rxjs';
import {
  RequestLogConfig,
  RequestLogConfigService,
} from '@/config/request-log.config';
import { CreateRequestLogDto } from '@/modules/admin/request-log/dto/request-log.dto';
import { RequestLogService } from '@/modules/admin/request-log/request-log.service';
import { MaxMindGeoIPService } from '../services/maxmind-geoip.service';

/**
 * 基础请求日志拦截器
 * 提供通用的请求日志记录功能，可被admin和client拦截器继承
 */
@Injectable()
export abstract class BaseRequestLogInterceptor implements NestInterceptor {
  protected readonly logger: Logger;
  protected readonly config: RequestLogConfig;

  constructor(
    protected readonly requestLogService: RequestLogService,
    protected readonly reflector: Reflector,
    protected readonly maxMindGeoIPService: MaxMindGeoIPService,
    loggerName: string,
    config: RequestLogConfig
  ) {
    this.logger = new Logger(loggerName);
    this.config = config;
  }

  /**
   * 拦截请求并记录日志
   * @param context 执行上下文
   * @param next 下一个处理器
   * @returns Observable
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();
    const startTime = Date.now();

    // 检查是否启用日志记录
    if (!this.config.enabled) {
      return next.handle();
    }

    // 检查是否跳过日志记录（装饰器）
    const skipLogging = this.reflector.get<boolean>(
      'skipRequestLog',
      context.getHandler()
    );

    if (skipLogging) {
      return next.handle();
    }

    // 检查路径是否应该跳过
    if (RequestLogConfigService.shouldSkipPath(request.url, this.config)) {
      return next.handle();
    }

    // 检查HTTP方法是否应该跳过
    if (RequestLogConfigService.shouldSkipMethod(request.method, this.config)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        // 请求成功时记录日志
        this.logRequest(request, response, startTime, null);
      }),
      catchError(error => {
        // 请求失败时记录日志
        this.logRequest(request, response, startTime, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * 记录请求日志
   * @param request 请求对象
   * @param response 响应对象
   * @param startTime 请求开始时间
   * @param error 错误信息（如果有）
   */
  protected async logRequest(
    request: FastifyRequest,
    response: FastifyReply,
    startTime: number,
    error?: any
  ): Promise<void> {
    try {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 获取用户信息（由子类实现）
      const userInfo = this.extractUserInfo(request);

      // 获取客户端IP地址
      const clientIp = this.getClientIp(request);

      // 获取IP地址地理位置信息
      const geoLocation =
        await this.maxMindGeoIPService.getGeoLocation(clientIp);
      const ipLocation = geoLocation.fullLocation;

      // 获取响应状态码
      const statusCode = error
        ? error.status || 500
        : response.statusCode || 200;

      // 获取响应描述
      const responseMessage = this.getResponseDescription(statusCode, error);

      // 获取API摘要信息（由子类实现）
      const operationDescription = this.getOperationDescription(request);

      // 构建请求参数字符串
      const requestParams = this.buildRequestParams(request);

      // 创建请求日志DTO
      const createRequestLogDto: CreateRequestLogDto = {
        username: this.extractUsername(request),
        userId: userInfo.userId ? Number(userInfo.userId) : undefined,
        ipLocation,
        ipAddress: clientIp,
        httpMethod: request.method,
        requestPath: request.url.split('?')[0],
        userAgent: request.headers['user-agent'] || 'Unknown',
        responseCode: statusCode,
        duration,
        responseMessage,
        operationDescription,
        requestParams,
      };

      // 异步记录日志，不阻塞请求响应
      setImmediate(async () => {
        await this.requestLogService.createRequestLog(createRequestLogDto);
      });
    } catch (error) {
      this.logger.error(
        `${this.getLogPrefix()}处理请求日志时发生错误: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * 获取客户端IP地址
   * @param request 请求对象
   * @returns IP地址
   */
  protected getClientIp(request: FastifyRequest): string {
    const forwarded = request.headers['x-forwarded-for'] as string;
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    const realIp = request.headers['x-real-ip'] as string;
    if (realIp) {
      return realIp;
    }

    return request.ip || 'Unknown';
  }

  /**
   * 获取响应描述
   * @param statusCode 状态码
   * @param error 错误信息
   * @returns 响应描述
   */
  protected getResponseDescription(statusCode: number, error?: any): string {
    if (error) {
      return error.message || `HTTP ${statusCode} Error`;
    }

    // 根据状态码返回描述
    const statusDescriptions: Record<number, string> = {
      200: '请求成功',
      201: '创建成功',
      204: '删除成功',
      400: '请求参数错误',
      401: '未授权访问',
      403: '禁止访问',
      404: '资源不存在',
      405: '请求方法不允许',
      422: '请求参数验证失败',
      429: '请求过于频繁',
      500: '服务器内部错误',
      502: '网关错误',
      503: '服务不可用',
      504: '网关超时',
    };

    return statusDescriptions[statusCode] || `HTTP ${statusCode}`;
  }

  /**
   * 根据HTTP方法获取操作动作
   * @param request
   * @returns 操作动作描述
   */
  protected getActionByMethod(request: FastifyRequest): string {
    console.log(
      '🚀 ~ BaseRequestLogInterceptor ~ getActionByMethod ~ request:',
      request
    );
    return '操作';
  }

  /**
   * 生成通用的操作记录描述
   * @param request 请求对象
   * @param userInfo 用户信息
   * @param userType 用户类型前缀
   * @returns 操作记录
   */
  protected generateOperationRecord(
    request: FastifyRequest,
    userInfo: { userId?: string; userPhone?: string },
    userType: string
  ): string {
    const action = this.getActionByMethod(request);
    const path = request.url.split('?')[0];
    const user = userInfo.userPhone || userInfo.userId;
    const userDesc = user ? `${userType}(${user})` : `匿名${userType}`;

    return `${userDesc}${action}了${path}`;
  }

  /**
   * 构建请求参数字符串
   * @param request 请求对象
   * @returns 请求参数JSON字符串
   */
  protected buildRequestParams(request: FastifyRequest): string | undefined {
    try {
      const params: any = {};

      // 添加查询参数
      if (request.query && Object.keys(request.query).length > 0) {
        params.query = request.query;
      }

      // 添加请求体参数（排除敏感信息）
      if (request.body && Object.keys(request.body).length > 0) {
        params.body = RequestLogConfigService.sanitizeData(
          request.body,
          this.config
        );
      }

      // 添加路径参数
      if (request.params && Object.keys(request.params).length > 0) {
        params.params = request.params;
      }

      const paramsStr =
        Object.keys(params).length > 0 ? JSON.stringify(params) : undefined;
      return paramsStr
        ? RequestLogConfigService.truncateParams(paramsStr, this.config)
        : undefined;
    } catch (error) {
      this.logger.warn(`构建请求参数失败: ${error.message}`);
      return undefined;
    }
  }

  /**
   * 清理请求体中的敏感信息
   * @param body 请求体
   * @returns 清理后的请求体
   */
  protected sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = this.getSensitiveFields();
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***';
      }
    }

    return sanitized;
  }

  // 抽象方法，由子类实现

  /**
   * 提取用户信息
   * @param request 请求对象
   * @returns 用户信息
   */
  protected abstract extractUserInfo(request: FastifyRequest): {
    userId?: string;
    userPhone?: string;
  };

  /**
   * 提取用户名
   * @param request 请求对象
   * @returns 用户名
   */
  protected abstract extractUsername(
    request: FastifyRequest
  ): string | undefined;

  /**
   * 获取API摘要信息
   * @param request 请求对象
   * @returns API摘要
   */
  protected abstract getOperationDescription(request: FastifyRequest): string;

  /**
   * 获取操作记录
   * @param request 请求对象
   * @param userInfo 用户信息
   * @returns 操作记录
   */
  protected abstract getOperationRecord(
    request: FastifyRequest,
    userInfo: { userId?: string; userPhone?: string }
  ): string;

  /**
   * 获取日志前缀
   * @returns 日志前缀
   */
  protected abstract getLogPrefix(): string;

  /**
   * 获取敏感字段列表
   * @returns 敏感字段数组
   */
  protected abstract getSensitiveFields(): string[];
}

/**
 * 跳过请求日志记录的装饰器
 * 用于标记不需要记录日志的接口
 */
export const SkipRequestLog = () => {
  return (
    target: any,
    propertyKey?: string,
    descriptor?: PropertyDescriptor
  ) => {
    if (descriptor) {
      Reflect.defineMetadata('skipRequestLog', true, descriptor.value);
    } else {
      Reflect.defineMetadata('skipRequestLog', true, target);
    }
  };
};
