import { Module } from '@nestjs/common'
import { AppUpdateService } from './update.service'

/**
 * App 更新模块。
 * 负责版本发布管理与客户端检查更新逻辑。
 */
@Module({
  providers: [AppUpdateService],
  exports: [AppUpdateService],
})
export class AppUpdateModule {}
