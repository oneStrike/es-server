// 定义 BaseModule 可接受的配置接口
export interface BaseModuleOptions {
  // 是否启用日志模块
  enableLogger?: boolean
  // 是否启用数据库模块
  enableDatabase?: boolean
  // 是否启用缓存模块
  enableCache?: boolean
  // 是否启用限流模块
  enableThrottler?: boolean
  // 是否启用健康检查模块
  enableHealth?: boolean
  // 是否启用全局验证管道
  enableGlobalValidationPipe?: boolean
  // 是否启用全局响应转换拦截器
  enableGlobalTransformInterceptor?: boolean
}
