import type { Pool } from 'pg'
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common'
import { DbNotificationService } from './db-notification.service'
import { DRIZZLE_POOL } from './drizzle.provider'
import { buildSafeDatabaseDiagnostic } from './error/error-handler'

/**
 * 协调 db/core 共享底层资源的关闭顺序，避免 LISTEN 订阅释放依赖隐式 hook 顺序。
 */
@Injectable()
export class DbLifecycleService implements OnApplicationShutdown {
  private readonly logger = new Logger(DbLifecycleService.name)
  private isClosed = false

  constructor(
    @Inject(DbNotificationService)
    private readonly dbNotificationService: DbNotificationService,
    @Inject(DRIZZLE_POOL) private readonly pool: Pool,
  ) {}

  /** 先释放通知订阅，再关闭共享连接池。 */
  async onApplicationShutdown(): Promise<void> {
    if (this.isClosed) {
      return
    }

    this.isClosed = true
    await this.closeSubscriptionsSafely()
    await this.closePoolSafely()
  }

  private async closeSubscriptionsSafely(): Promise<void> {
    try {
      await this.dbNotificationService.closeAllSubscriptions()
    } catch (error) {
      this.logger.warn('Failed to close database notification subscriptions', {
        database: buildSafeDatabaseDiagnostic(error),
      })
    }
  }

  private async closePoolSafely(): Promise<void> {
    try {
      await this.pool.end()
    } catch (error) {
      this.logger.warn('Failed to close PostgreSQL pool', {
        database: buildSafeDatabaseDiagnostic(error, {
          source: 'postgres-pool',
        }),
      })
    }
  }
}
