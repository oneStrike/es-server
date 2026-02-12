import type { ITokenStorageService } from './auth.types'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'

/**
 * 认证模块定时任务服务
 *
 * 职责：
 * 1. 定期清理过期的 Token
 * 2. 定期删除已撤销的旧 Token
 *
 * 设计原则：
 * - 使用 NestJS Schedule 模块实现定时任务
 * - 错误处理确保定时任务不会因异常而中断
 * - 日志记录便于监控和排查问题
 *
 * 性能考虑：
 * - 清理频率不宜过高，避免影响系统性能
 * - 建议在低峰期执行（如凌晨）
 * - 使用批量操作而非逐条删除
 */
@Injectable()
export class AuthCronService {
  private readonly logger = new Logger(AuthCronService.name)

  constructor(
    @Inject('ITokenStorageService')
    private readonly tokenStorageService: ITokenStorageService,
  ) {}

  /**
   * 每小时清理过期 Token
   *
   * 执行逻辑：
   * 1. 查询所有已过期但未撤销的 Token
   * 2. 批量标记为已撤销（TOKEN_EXPIRED）
   * 3. 记录清理数量到日志
   *
   * 性能考虑：
   * - 使用 updateMany 批量更新，性能优于逐条更新
   * - 每小时执行一次，避免数据累积过多
   * - 错误处理确保任务不会因异常而中断
   *
   * 业务价值：
   * - 自动清理过期 Token，减少无效数据
   * - 为用户查询设备列表时过滤掉过期设备
   * - 保持数据库表大小合理，提高查询性能
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredTokens() {
    try {
      const count = await this.tokenStorageService.cleanupExpiredTokens()
      if (count > 0) {
        this.logger.log(`清理了 ${count} 个过期 Token`)
      }
    } catch (error) {
      this.logger.error(`清理过期 Token 失败: ${error.message}`, error.stack)
    }
  }

  /**
   * 每天凌晨 2 点清理已撤销的旧 Token
   *
   * 执行逻辑：
   * 1. 查询所有已撤销且超过 30 天的 Token
   * 2. 批量删除这些 Token
   * 3. 记录删除数量到日志
   *
   * 性能考虑：
   * - 使用 deleteMany 批量删除，性能优于逐条删除
   * - 每天凌晨 2 点执行（系统低峰期）
   * - 保留 30 天审计记录，平衡存储和审计需求
   *
   * 业务价值：
   * - 定期清理历史数据，减少数据库存储压力
   * - 保留审计记录，满足合规和安全审计需求
   * - 保持数据库表大小合理，提高查询性能
   *
   * 注意事项：
   * - 删除操作不可逆，请确保保留天数设置合理
   * - 建议在业务低峰期执行，避免影响用户体验
   * - 可根据实际业务需求调整保留天数
   */
  @Cron('0 2 * * *')
  async cleanupOldRevokedTokens() {
    try {
      const count = await this.tokenStorageService.deleteOldRevokedTokens(30)
      if (count > 0) {
        this.logger.log(`清理了 ${count} 个已撤销的旧 Token（保留 30 天）`)
      }
    } catch (error) {
      this.logger.error(`清理已撤销 Token 失败: ${error.message}`, error.stack)
    }
  }
}
