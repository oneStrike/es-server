import type { ITokenStorageService } from './auth.types'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'

/**
 * 认证模块定时任务服务
 * 负责清理过期 Token 和历史撤销 Token
 */
@Injectable()
export class AuthCronService {
  private readonly logger = new Logger(AuthCronService.name)

  constructor(
    @Inject('ITokenStorageService')
    private readonly tokenStorageService: ITokenStorageService,
  ) {}

  /**
   * 每小时清理一次过期 Token
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredTokens() {
    try {
      const count = await this.tokenStorageService.cleanupExpiredTokens()
      if (count > 0) {
        this.logger.log(`清理了 ${count} 个过期 Token`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`清理过期 Token 失败: ${message}`, stack)
    }
  }

  /**
   * 每天凌晨 2 点清理长期保留的撤销 Token
   */
  @Cron('0 2 * * *')
  async cleanupOldRevokedTokens() {
    try {
      const count = await this.tokenStorageService.deleteOldRevokedTokens(30)
      if (count > 0) {
        this.logger.log(`清理了 ${count} 个已撤销的旧 Token（保留 30 天）`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`清理已撤销 Token 失败: ${message}`, stack)
    }
  }
}
