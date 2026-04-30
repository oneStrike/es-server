/**
 * 请求头中携带 request id 的最小结构。
 */
export interface RequestIdHeaderCarrier {
  headers?: {
    'x-request-id'?: string
  }
}

/**
 * PlatformModule 配置选项
 */
export interface PlatformModuleOptions {
  /** 是否启用日志模块 */
  enableLogger?: boolean
  /** 是否启用数据库模块 */
  enableDatabase?: boolean
  /** 是否启用缓存模块 */
  enableCache?: boolean
  /** 是否启用限流模块 */
  enableThrottler?: boolean
  /** 是否启用健康检查模块 */
  enableHealth?: boolean
  /** 是否启用全局验证管道 */
  enableGlobalValidationPipe?: boolean
  /** 是否启用全局响应转换拦截器 */
  enableGlobalTransformInterceptor?: boolean
}
