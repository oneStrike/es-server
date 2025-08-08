import { SetMetadata } from '@nestjs/common'
import { LogModule as LoggerConfigModule } from '@/config/logger.config'

/**
 * 日志装饰器元数据键
 */
export const LOG_MODULE_KEY = 'log_module'
export const LOG_CONTEXT_KEY = 'log_context'
export const LOG_PERFORMANCE_KEY = 'log_performance'
export const LOG_BUSINESS_KEY = 'log_business'

/**
 * 日志模块装饰器
 * 用于指定控制器或方法使用的日志模块
 */
export function LogModule(module: LoggerConfigModule) {
  return SetMetadata(LOG_MODULE_KEY, module)
}

/**
 * 日志上下文装饰器
 * 用于设置日志上下文信息
 */
export function LogContext(context: string) {
  return SetMetadata(LOG_CONTEXT_KEY, context)
}

/**
 * 性能日志装饰器
 * 自动记录方法执行时间
 */
export function LogPerformance(operation?: string) {
  return SetMetadata(LOG_PERFORMANCE_KEY, operation || true)
}

/**
 * 业务日志装饰器
 * 自动记录业务操作结果
 */
export function LogBusiness(action?: string) {
  return SetMetadata(LOG_BUSINESS_KEY, action || true)
}

/**
 * 组合装饰器：Admin模块日志
 */
export function AdminLog(context?: string) {
  return function (
    target: object,
    propertyKey: string | symbol | undefined = '',
    descriptor: PropertyDescriptor = {
      configurable: true,
      enumerable: true,
      writable: true,
    },
  ) {
    LogModule(LoggerConfigModule.ADMIN)(target, propertyKey, descriptor)
    if (context) {
      LogContext(context)(target, propertyKey, descriptor)
    }
  }
}

/**
 * 组合装饰器：Client模块日志
 */
export function ClientLog(context?: string) {
  return function (
    target: object,
    propertyKey: string | symbol | undefined = '',
    descriptor: PropertyDescriptor = {},
  ) {
    LogModule(LoggerConfigModule.CLIENT)(target, propertyKey, descriptor)
    if (context) {
      LogContext(context)(target, propertyKey, descriptor)
    }
  }
}

/**
 * 组合装饰器：全局模块日志
 */
export function GlobalLog(context?: string) {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    LogModule(LoggerConfigModule.GLOBAL)(target, propertyKey, descriptor)
    if (context) {
      LogContext(context)(target, propertyKey, descriptor)
    }
  }
}
