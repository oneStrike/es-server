import type { CustomLoggerService } from '@/common/module/logger/logger.service'

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
