import type { INestApplication } from '@nestjs/common'
import type { CustomLoggerService } from '@/common/module/logger/logger.service'

declare const module: any

/**
 * 配置热模块替换（HMR）
 * 仅在开发环境启用
 */
export function setupHotReload(
  app: INestApplication,
  logger: CustomLoggerService,
) {
  // 检查是否支持热重载
  if (!module.hot) {
    return
  }

  module.hot.accept()
  module.hot.dispose(async () => {
    logger.info('应用程序正在热重载...')
    await app.close()
  })
}

/**
 * 打印应用启动信息
 */
export function logStartupInfo(
  port: number | string,
  logger: CustomLoggerService,
) {
  logger.info(`🚀 应用程序已启动`)
  logger.info(`📍 本地访问地址: http://localhost:${port}`)
  logger.info(`📍 网络访问地址: http://127.0.0.1:${port}`)
  logger.info(`📖 API 文档地址: http://localhost:${port}/api/docs`)
  logger.info(`🔧 管理后台 API: http://localhost:${port}/api/admin`)
  logger.info(`👥 客户端 API: http://localhost:${port}/api/client`)
  logger.info(`💚 健康检查: http://localhost:${port}/api/health`)
}
