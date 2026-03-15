import { DrizzleModule } from '@db/drizzle.module'
import { Module } from '@nestjs/common'
import { AppConfigService } from './config.service'

/**
 * 应用配置模块
 * 提供应用基础配置的管理功能
 */
@Module({
  imports: [DrizzleModule],
  controllers: [],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
