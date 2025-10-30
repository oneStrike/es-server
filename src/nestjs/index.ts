/**
 * NestJS 应用配置模块
 * 统一导出应用初始化相关的配置函数
 */

export { setupApp } from './app.setup'
export { setupCompression } from './compression'
export { setupHealthChecks } from './health'
export { logStartupInfo, setupHotReload } from './lifecycle'
export { setupMultipart } from './multipart'
export { setupSwagger } from './swagger'
